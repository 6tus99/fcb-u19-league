-- =====================================================================
--  MATCH EVENT NOTIFICATIONS FOR FANS
--  Everyone in the league gets an in-app notification (bell + toast)
--  when, for any match:
--    - the match starts          (status scheduled -> live)
--    - a goal is scored
--    - a foul / card is booked   (yellow or red)
--    - a substitution is made
--    - the first half ends
--    - the second half begins
--    - added time is announced
--    - the match ends            (status -> finished, with the result)
--  New event types: half_time, second_half, extra_time
--  (The notifications table, the bell and realtime already exist.)
-- =====================================================================

-- 1. allow the new event types
alter table public.match_events drop constraint if exists match_events_event_type_check;
alter table public.match_events add constraint match_events_event_type_check
  check (event_type in ('goal','yellow_card','red_card','substitution','note',
                        'half_time','second_half','extra_time'));

-- 2. everyone in the league
create or replace function public.all_user_ids()
returns uuid[]
language sql
security definer set search_path = public
stable
as $$
  select coalesce(array_agg(id), '{}') from public.profiles;
$$;

-- 3. notification on every important match event
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
    perform public.notify_users(public.all_user_ids(),
      'GOAL! ' || v_home || ' v ' || v_away,
      v_team || ' score in Week ' || v_match.week || coalesce(' (' || new.minute || ' min)', '') || '.',
      '/matches/' || new.match_id);
  elsif new.event_type = 'yellow_card' or new.event_type = 'red_card' then
    perform public.notify_users(public.all_user_ids(),
      case new.event_type when 'yellow_card' then 'Foul - yellow card' else 'Foul - red card' end,
      v_team || ' in ' || v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  elsif new.event_type = 'substitution' then
    perform public.notify_users(public.all_user_ids(),
      'Substitution',
      v_team || ' in ' || v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  elsif new.event_type = 'half_time' then
    perform public.notify_users(public.all_user_ids(),
      'End of first half',
      v_home || ' ' || v_match.home_score || '-' || v_match.away_score || ' ' || v_away,
      '/matches/' || new.match_id);
  elsif new.event_type = 'second_half' then
    perform public.notify_users(public.all_user_ids(),
      'Second half begins',
      v_home || ' ' || v_match.home_score || '-' || v_match.away_score || ' ' || v_away,
      '/matches/' || new.match_id);
  elsif new.event_type = 'extra_time' then
    perform public.notify_users(public.all_user_ids(),
      'Added time',
      v_home || ' v ' || v_away || ' (Week ' || v_match.week || ')',
      '/matches/' || new.match_id);
  end if;

  return new;
end
$$;

drop trigger if exists on_match_event_notify on public.match_events;
create trigger on_match_event_notify
  after insert on public.match_events
  for each row execute function public.notify_match_event();

-- 4. notification on match start / full time
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
    perform public.notify_users(public.all_user_ids(),
      'Match started',
      v_home || ' v ' || v_away || ' - Week ' || new.week || coalesce(' - ' || new.venue, ''),
      '/matches/' || new.id);
  elsif new.status = 'finished' then
    perform public.notify_users(public.all_user_ids(),
      'Full time',
      v_home || ' ' || new.home_score || '-' || new.away_score || ' ' || v_away || ' - Week ' || new.week,
      '/matches/' || new.id);
  end if;

  return new;
end
$$;

drop trigger if exists on_match_status_notify on public.matches;
create trigger on_match_status_notify
  after update on public.matches
  for each row execute function public.notify_match_status();
