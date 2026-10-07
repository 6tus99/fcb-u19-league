// Supabase Edge Function: delete-user
// Deletes a registered member's account FOR GOOD (auth + profile + their
// requests, role codes, etc. — the database cascades take care of the rest).
// Admin only, and an admin can never delete themselves.
//
// Setup (Supabase Dashboard):
//   Functions → Create new function → name: delete-user → paste this file → Deploy

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
  const id = String(body.id || "");
  if (!id) return json({ error: "id is required" }, 400);
  if (id === user.id)
    return json({ error: "You cannot delete your own account." }, 400);

  // Deleting the auth user cascades to the profile and everything linked.
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
