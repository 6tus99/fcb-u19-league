-- =====================================================================
--  FCB Under 19 — Upgrade: notifications (in-app message bell)
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  What this adds:
--   * public.notifications — one row per message for one user.
--   * Triggers on requests — the database writes the notifications:
--       - admin is notified when a manager requests a player or a
--         player requests a transfer
--       - the player + the manager are notified when a request is
--         approved or declined
--       - both team managers are notified on an approved transfer
--   * Row-level security — users only see their own notifications
--     and can only mark their own as read.
--   * Realtime — the bell updates live without refreshing.
-- =====================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- -------------------------- row security ----------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications: users view own" on public.notifications;
create policy "notifications: users view own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: users mark own read" on public.notifications;
create policy "notifications: users mark own read"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --------------------- helper ---------------------------------------
create or replace function public.notify_users(uids uuid[], title text, body text, link text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select u, title, body, link
  from unnest(uids) as u
  where u is not null;
end;
$$;

-- ---------- notifications when a request is created -----------------
create or replace function public.handle_request_notified()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_player text;
  v_requester text;
  v_team text;
  v_from text;
  v_admins uuid[];
begin
  select full_name into v_player from public.profiles where id = new.player_profile_id;
  select full_name into v_requester from public.profiles where id = new.requested_by;
  select name into v_team from public.teams where id = new.team_id;

  if new.type = 'add_player' then
    select array_agg(id) into v_admins from public.profiles where role = 'admin';
    perform public.notify_users(
      v_admins,
      'New player addition request',
      coalesce(v_requester, 'A manager') || ' requested to add ' || coalesce(v_player, 'a player') || ' to ' || coalesce(v_team, 'their team') || '.',
      '/admin/requests'
    );
  else
    select name into v_from from public.teams where id = new.from_team_id;
    select array_agg(id) into v_admins from public.profiles where role = 'admin';
    perform public.notify_users(
      v_admins,
      'New transfer request',
      coalesce(v_player, 'A player') || ' requests a transfer from ' || coalesce(v_from, '?') || ' to ' || coalesce(v_team, '?') || '.',
      '/admin/requests'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_request_notified on public.requests;
create trigger on_request_notified
after insert on public.requests
for each row execute function public.handle_request_notified();

-- ---------- notifications when a request is resolved ----------------
create or replace function public.handle_request_resolved_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_player text;
  v_requester text;
  v_team text;
  v_from text;
  v_manager uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending' then
    return new;
  end if;

  select full_name into v_player from public.profiles where id = new.player_profile_id;
  select full_name into v_requester from public.profiles where id = new.requested_by;
  select name into v_team from public.teams where id = new.team_id;
  select name into v_from from public.teams where id = new.from_team_id;

  if new.type = 'add_player' then
    if new.status = 'approved' then
      perform public.notify_users(array[new.player_profile_id],
        'You have been added to a team',
        coalesce(v_requester, 'The manager') || ' requested to add you and the league admin approved. You are now with ' || coalesce(v_team, 'the team') || '.',
        '/');
      perform public.notify_users(array[new.requested_by],
        'Player addition approved',
        coalesce(v_player, 'The player') || ' was added to ' || coalesce(v_team, 'your team') || '.',
        '/manager');
    else
      perform public.notify_users(array[new.player_profile_id],
        'Player addition declined',
        'The request to add you to ' || coalesce(v_team, 'a team') || ' was declined by the league admin.',
        '/');
      perform public.notify_users(array[new.requested_by],
        'Player addition declined',
        'Your request to add ' || coalesce(v_player, 'a player') || ' to ' || coalesce(v_team, 'your team') || ' was declined by the league admin.',
        '/manager');
    end if;
  else
    if new.status = 'approved' then
      perform public.notify_users(array[new.player_profile_id],
        'Transfer approved',
        'Your transfer from ' || coalesce(v_from, '?') || ' to ' || coalesce(v_team, '?') || ' was approved by the league admin.',
        '/');
      select id into v_manager from public.profiles
        where role = 'manager' and team_id = new.from_team_id limit 1;
      if v_manager is not null then
        perform public.notify_users(array[v_manager],
          'Player left your team',
          coalesce(v_player, 'A player') || ' transferred from ' || coalesce(v_from, '?') || ' to ' || coalesce(v_team, '?') || '.',
          '/manager');
      end if;
      select id into v_manager from public.profiles
        where role = 'manager' and team_id = new.team_id limit 1;
      if v_manager is not null then
        perform public.notify_users(array[v_manager],
          'New player joined your team',
          coalesce(v_player, 'A player') || ' transferred to ' || coalesce(v_team, 'your team') || '.',
          '/manager');
      end if;
    else
      perform public.notify_users(array[new.player_profile_id],
        'Transfer declined',
        'Your transfer request to ' || coalesce(v_team, '?') || ' was declined by the league admin. You remain with ' || coalesce(v_from, 'your team') || '.',
        '/');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_request_resolved_notify on public.requests;
create trigger on_request_resolved_notify
after update on public.requests
for each row execute function public.handle_request_resolved_notify();

-- ----------------------- realtime -----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
