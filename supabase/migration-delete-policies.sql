-- ============================================================
-- Delete permissions for league admins (teams / matches / news /
-- officials). Idempotent: safe to run more than once.
-- Run in the Supabase SQL Editor.
-- (Deleting a USER is different — it needs the "delete-user"
-- Supabase function, because user logins live in a separate
-- system. See the app's Users page.)
-- ============================================================

drop policy if exists "admins delete teams" on public.teams;
create policy "admins delete teams" on public.teams for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete matches" on public.matches;
create policy "admins delete matches" on public.matches for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete news" on public.news;
create policy "admins delete news" on public.news for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete officials" on public.officials;
create policy "admins delete officials" on public.officials for delete to authenticated
  using (public.has_role('{admin}'));
