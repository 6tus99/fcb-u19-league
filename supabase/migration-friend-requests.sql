-- =====================================================================
--  FRIEND REQUESTS (confirm / decline) — Messages > Friends
--  Adds a status to supporters: pending -> accepted | declined.
--  Existing rows become accepted (already friends).
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

alter table public.supporters add column if not exists status text not null default 'accepted';

-- both members of a pair can see it (so the invitee sees the request)
drop policy if exists "supporters: view own" on public.supporters;
create policy "supporters: view involved" on public.supporters
  for select to authenticated
  using (user_id = auth.uid() or added_id = auth.uid());

-- you can send requests (or the legacy direct-add) from yourself
drop policy if exists "supporters: add own" on public.supporters;
create policy "supporters: send request" on public.supporters
  for insert to authenticated
  with check (user_id = auth.uid() and status in ('pending', 'accepted'));

-- only the person the request is addressed to can accept/decline
create policy "supporters: respond request" on public.supporters
  for update to authenticated
  using (added_id = auth.uid())
  with check (added_id = auth.uid() and status in ('accepted', 'declined'));

-- either member can remove the friendship / cancel
drop policy if exists "supporters: delete own" on public.supporters;
create policy "supporters: remove involved" on public.supporters
  for delete to authenticated
  using (user_id = auth.uid() or added_id = auth.uid());

-- make PostgREST see the changes right away
notify pgrst, 'reload schema';
