-- =====================================================================
--  NOTIFICATIONS: THE CREATOR IS NOT ALERTED BY THEIR OWN ACTIONS
--  When the commissioner/admin makes a match change (start, goal,
--  foul, card, half time, added time, full time), they already know
--  about it — they just did it. So they no longer receive their own
--  match notifications (no pop-out, no list entry, no badge).
--  EVERYONE ELSE still receives them, and their bell pops them out
--  one by one.
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

-- Helper: same list of user ids, minus the person who caused the
-- action (auth.uid() is the logged-in user whose request fired the
-- trigger). If the change comes from the SQL editor / service key
-- (no logged-in user), everyone still gets the notification.
create or replace function public.excluding_actor(p_ids uuid[])
returns uuid[]
language sql
stable
as $$
  select case
    when auth.uid() is null then p_ids
    else array_remove(p_ids, auth.uid())
  end;
$$;

-- Match event notifications (goal / foul / cards / sub / halves /
-- added time) — creator excluded.
create or replace function public.notify_match_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_match public.matches;
  v_home text;
  v_away text;
  v_team text;
begin
  select * into v_match from public.matches where id = new.match_id;
  if v_match is null then
    return new;
  end if;
  v_home := (select name from public.teams where id = v_match.home_team_id);
  v_away := (select name from public.teams where id = v_match.away_team_id);
  v_team := (select name from public.teams where id = new.team_id);
  if v_team is null then
    v_team := 'A team';
  end if;

  if new.event_type = 'goal' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'GOAL! ' || v_home || ' v ' || v_away,
      v_team || ' score in Week ' || v_match.week || coalesce(' (' || new.minute || ' min)', '') || '.',
      '/matches/' || new.match_id);
  elsif new.event_type = 'foul' or new.event_type = 'yellow_card' or new.event_type = 'red_card' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      case new.event_type
        when 'foul' then 'Foul'
        when 'yellow_card' then 'Foul - yellow card'
        else 'Foul - red card' end,
      v_team || ' in ' || v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  elsif new.event_type = 'substitution' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'Substitution',
      v_team || ' in ' || v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  elsif new.event_type = 'half_time' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'End of first half',
      v_home || ' ' || v_match.home_score || '-' || v_match.away_score || ' ' || v_away,
      '/matches/' || new.match_id);
  elsif new.event_type = 'second_half' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'Second half begins',
      v_home || ' ' || v_match.home_score || '-' || v_match.away_score || ' ' || v_away,
      '/matches/' || new.match_id);
  elsif new.event_type = 'extra_time' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'Added time',
      v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  end if;

  return new;
end
$$;

-- Match start / full time notifications — creator excluded.
create or replace function public.notify_match_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_home text;
  v_away text;
begin
  if new.status = old.status then
    return new;
  end if;
  v_home := (select name from public.teams where id = new.home_team_id);
  v_away := (select name from public.teams where id = new.away_team_id);

  if old.status = 'scheduled' and new.status = 'live' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'Match started',
      v_home || ' v ' || v_away || ' - Week ' || new.week || coalesce(' - ' || new.venue, ''),
      '/matches/' || new.id);
  elsif new.status = 'finished' then
    perform public.notify_users(public.excluding_actor(public.all_user_ids()),
      'Full time',
      v_home || ' ' || new.home_score || '-' || new.away_score || ' ' || v_away || ' - Week ' || new.week,
      '/matches/' || new.id);
  end if;

  return new;
end
$$;
