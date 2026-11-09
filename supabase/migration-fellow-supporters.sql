-- =====================================================================
--  FELLOW SUPPORTERS (Messages -> People)
--  - supporters — member A adds member B as a fellow supporter.
--                 One-directional, one row per pair, removable.
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

create table if not exists public.supporters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,  -- who added
  added_id uuid not null references public.profiles (id) on delete cascade, -- who was added
  created_at timestamptz not null default now(),
  unique (user_id, added_id),
  check (user_id <> added_id)
);
create index if not exists supporters_user_idx on public.supporters (user_id);
create index if not exists supporters_added_idx on public.supporters (added_id);

alter table public.supporters enable row level security;
drop policy if exists "supporters: view own" on public.supporters;
create policy "supporters: view own" on public.supporters
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "supporters: add own" on public.supporters;
create policy "supporters: add own" on public.supporters
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "supporters: delete own" on public.supporters;
create policy "supporters: delete own" on public.supporters
  for delete to authenticated using (user_id = auth.uid());

-- make PostgREST see the new table right away
notify pgrst, 'reload schema';
