-- =====================================================================
--  ASSIGNMENT NOTIFICATIONS
--  When the league admin assigns a commissioner or an official
--  (referee) to a match, that person gets an in-app notification
--  (bell + toast): "New match assignment — You have been assigned
--  to officiate Home v Away — Week N, date at venue."
--
--  Commissioners are app users, so they are notified directly.
--  Officials are names in the officials table — link one to an app
--  account (Manage Officials -> "Link to app user") and that account
--  gets the notification too.
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

-- 1. an official can be linked to an app account
alter table public.officials
  add column if not exists user_id uuid
  references public.profiles (id) on delete set null;

-- 2. notify on assignment
create or replace function public.notify_match_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_home text;
  v_away text;
  v_when text;
  v_official record;
begin
  v_home := (select name from public.teams where id = new.home_team_id);
  v_away := (select name from public.teams where id = new.away_team_id);
  v_when := 'Week ' || new.week || ', '
            || to_char(new.scheduled_at, 'DD Mon YYYY, HH24:MI')
            || coalesce(' at ' || new.venue, '');

  -- commissioner newly assigned
  if new.commissioner_id is not null
     and (tg_op = 'INSERT' or new.commissioner_id is distinct from old.commissioner_id) then
    perform public.notify_users(
      array[new.commissioner_id],
      'New match assignment',
      'You have been assigned to officiate ' || v_home || ' v ' || v_away || ' — ' || v_when || '.',
      '/commissioner/match-center/live/' || new.id);
  end if;

  -- official (referee) newly assigned — only if linked to an app account
  if new.referee_id is not null
     and (tg_op = 'INSERT' or new.referee_id is distinct from old.referee_id) then
    select o.user_id, o.name, o.type into v_official
      from public.officials o where o.id = new.referee_id;
    if v_official.user_id is not null then
      perform public.notify_users(
        array[v_official.user_id],
        'New match assignment',
        'You have been assigned as '
          || case when v_official.type = 'assistant_referee' then 'assistant referee' else 'referee' end
          || ' for ' || v_home || ' v ' || v_away || ' — ' || v_when || '.',
        '/matches/' || new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_match_assignment on public.matches;
create trigger trg_notify_match_assignment
  after insert or update of commissioner_id, referee_id on public.matches
  for each row execute function public.notify_match_assignment();

notify pgrst, 'reload schema';
