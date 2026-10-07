// Supabase Edge Function: verify-role-code
// Checks the 6-digit code a user entered against the stored hash, then
// applies the new role. Includes CORS headers so browser calls work.

Deno.serve(async (req) => {
  // Answer the browser's handshake.
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await service.auth.getUser(jwt);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code" }, 400);

  const { data: pending } = await service
    .from("pending_role_changes")
    .select("*")
    .eq("profile_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!pending)
    return json({ error: "No pending role change for you right now." }, 404);
  if (new Date(pending.expires_at).getTime() < Date.now())
    return json({ error: "That code has expired. Ask the admin to send a new one." }, 410);

  const codeHash = await sha256Hex(code);
  if (codeHash !== pending.code_hash)
    return json({ error: "Wrong code. Try again." }, 400);

  const { error: pErr } = await service
    .from("profiles")
    .update({ role: pending.new_role })
    .eq("id", user.id);
  if (pErr) return json({ error: pErr.message }, 500);

  const { error: vErr } = await service
    .from("pending_role_changes")
    .update({ status: "verified", verified_at: new Date().toISOString() })
    .eq("id", pending.id);
  if (vErr) return json({ error: vErr.message }, 500);

  return json({ ok: true, role: pending.new_role });
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

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
    headers: { "Content-Type": "application/json", ...cors() },
  });
}
