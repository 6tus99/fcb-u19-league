// Supabase Edge Function: send-role-code
// Called by a league admin when granting a role. Generates a 6-digit code,
// stores its SHA-256 hash, and sends the code by EMAIL via Resend.
// (SMS via Twilio stays wired in for later — add those secrets to enable.)
//
// Setup (Supabase Dashboard):
//   Functions → Create new function → name: send-role-code → paste this file → Deploy
// Secrets (Functions → Secrets → + Add secret):
//   RESEND_API_KEY   from resend.com (required for email)
//   RESEND_FROM      optional, e.g.  FCB U19 League <onboarding@resend.dev>

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
  const { profile_id, new_role } = body;
  if (!profile_id || !new_role)
    return json({ error: "profile_id and new_role are required" }, 400);
  if (!["admin", "commissioner", "manager", "player", "fan"].includes(new_role))
    return json({ error: "Invalid role" }, 400);

  const { data: target } = await service
    .from("profiles")
    .select("email, phone")
    .eq("id", profile_id)
    .single();
  if (!target) return json({ error: "User not found" }, 404);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);

  const { error: insErr } = await service.from("pending_role_changes").insert({
    profile_id,
    new_role,
    code_hash: codeHash,
    phone: target.phone || null,
    requested_by: user.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (insErr) return json({ error: insErr.message }, 500);

  let sent = false;
  let emailError = '';

  // Email via Resend — when it cannot send, it says exactly why.
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    emailError =
      'RESEND_API_KEY secret is not visible to this function. Check Functions → Secrets, then re-deploy this function (secrets are loaded at deploy time).';
  } else if (!target.email) {
    emailError = 'The user has no email address on file.';
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            Deno.env.get("RESEND_FROM") ||
            "FCB U19 League <onboarding@resend.dev>",
          to: [target.email],
          subject: "FCB U19 League — your role verification code",
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
            <h2 style="color:#1e3a8a;margin:0 0 8px">FCB Under-19 League</h2>
            <p>Hello,</p>
            <p>Your role is being updated to <b>${new_role}</b>. Open the app and enter this code to activate it:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#16a34a;margin:16px 0">${code}</p>
            <p style="color:#64748b;font-size:13px">The code expires in 15 minutes. If you did not ask for this, you can ignore this email.</p>
          </div>`,
        }),
      });
      if (res.ok) {
        sent = true;
      } else {
        const errText = await res.text().catch(() => '');
        emailError = `Resend refused the email (HTTP ${res.status}): ${errText.slice(0, 300)}`;
      }
    } catch (e) {
      emailError = `Resend request failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // SMS via Twilio (for later — add TWILIO_* secrets to enable)
  if (!sent) {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    if (
      sid && Deno.env.get("TWILIO_AUTH_TOKEN") &&
      Deno.env.get("TWILIO_FROM_NUMBER") && target.phone
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
              To: target.phone,
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
  }

  return json({
    ok: true,
    sent,
    devCode: sent ? null : code,
    email: target.email,
    phone: target.phone,
    emailError,
  });
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
