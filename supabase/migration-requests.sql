-- =====================================================================
--  FCB Under 19 — Upgrade: team requests (player additions + transfers)
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  What this adds:
--   * public.requests  — manager "add player" requests and player
--     "transfer" requests, reviewed by the league admin.
--   * Approval trigger — when an admin approves, the player is added to
--     the team (or moved) automatically.
--   * Row-level security — managers can only request for their own team,
--     players can only transfer themselves, only admins resolve.
--   * Realtime — requests stream to connected dashboards.
-- =====================================================================

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('add_player', 'transfer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  from_team_id uuid references public.teams (id) on delete set null,
  player_profile_id uuid not null references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

-- -------------------------- row security ----------------------------
alter table public.requests enable row level security;

drop policy if exists "requests: view own, team, or all (admin)" on public.requests;
create policy "requests: view own, team, or all (admin)"
  on public.requests for select to authenticated
  using (
    public.has_role('{admin}')
    or requested_by = auth.uid()
    or (type = 'add_player'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.team_id = public.requests.team_id
        ))
  );

drop policy if exists "requests: managers add, players transfer" on public.requests;
create policy "requests: managers add, players transfer"
  on public.requests for insert to authenticated
  with check (
    (type = 'add_player'
      and public.has_role('{manager}')
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.team_id = public.requests.team_id
      ))
    or
    (type = 'transfer'
      and player_profile_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.team_id = public.requests.from_team_id
      ))
  );

drop policy if exists "requests: admins resolve" on public.requests;
create policy "requests: admins resolve"
  on public.requests for update to authenticated
  using (public.has_role('{admin}'))
  with check (public.has_role('{admin}'));

-- --------------------- approval trigger -----------------------------
-- When an admin sets status to approved/rejected, apply the effect.
create or replace function public.handle_request_resolution()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending' then
    return new;
  end if;

  new.resolved_at := coalesce(new.resolved_at, now());
  new.resolved_by := coalesce(new.resolved_by, auth.uid());

  if new.status = 'approved' then
    if new.type = 'add_player' then
      update public.profiles
         set team_id = new.team_id,
             role = case when role in ('fan', 'player') then 'player' else role end
       where id = new.player_profile_id;
    elsif new.type = 'transfer' then
      update public.profiles
         set team_id = new.team_id
       where id = new.player_profile_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_request_resolved on public.requests;
create trigger on_request_resolved
before update on public.requests
for each row execute function public.handle_request_resolution();

-- ----------------------- realtime -----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
