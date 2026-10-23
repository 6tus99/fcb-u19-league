-- =====================================================================
--  ADD "FOUL" EVENT TYPE
--  The live control panel now has a separate Foul button per team
--  (apart from yellow/red cards). This adds the event type and makes
--  fans get a "Foul" notification for it.
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

alter table public.match_events drop constraint if exists match_events_event_type_check;
alter table public.match_events add constraint match_events_event_type_check
  check (event_type in ('goal','yellow_card','red_card','substitution','note','foul',
                        'half_time','second_half','extra_time'));

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
  elsif new.event_type = 'foul' or new.event_type = 'yellow_card' or new.event_type = 'red_card' then
    perform public.notify_users(public.all_user_ids(),
      case new.event_type
        when 'foul' then 'Foul'
        when 'yellow_card' then 'Foul - yellow card'
        else 'Foul - red card' end,
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
