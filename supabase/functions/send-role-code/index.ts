// Supabase Edge Function: send-role-code
// Called by a league admin when granting a role. Generates a 6-digit code,
// stores its SHA-256 hash in pending_role_changes, and sends the code by SMS
// via Twilio when the Twilio secrets are configured.
//
// Setup (Supabase Dashboard):
//   Functions → Create new function → name: send-role-code → paste this file.
// Optional secrets (Functions → send-role-code → Secrets):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
// Without them the code is returned to the admin screen for manual relay.

Deno.serve(async (req) => {
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await service.auth.getUser(jwt);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { data: me } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return json({ error: "Admin only" }, 403);

  const body = await req.json().catch(() => ({}));
  const { profile_id, new_role, phone } = body;
  if (!profile_id || !new_role)
    return json({ error: "profile_id and new_role are required" }, 400);
  if (!["admin", "commissioner", "manager", "player", "fan"].includes(new_role))
    return json({ error: "Invalid role" }, 400);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);

  const { error: insErr } = await service.from("pending_role_changes").insert({
    profile_id,
    new_role,
    code_hash: codeHash,
    phone: phone || null,
    requested_by: user.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (insErr) return json({ error: insErr.message }, 500);

  let sent = false;
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  if (
    sid && Deno.env.get("TWILIO_AUTH_TOKEN") &&
    Deno.env.get("TWILIO_FROM_NUMBER") && phone
  ) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " + btoa(`${sid}:${Deno.env.get("TWILIO_AUTH_TOKEN")}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: phone,
            From: Deno.env.get("TWILIO_FROM_NUMBER")!,
            Body: `FCB U19 League: your role verification code is ${code}. It expires in 15 minutes. Do not share it.`,
          }),
        }
      );
      sent = res.ok;
    } catch {
      sent = false;
    }
  }

  return json({ ok: true, sent, devCode: sent ? null : code, phone });
});

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
