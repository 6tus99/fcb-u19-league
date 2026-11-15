-- Refresh unfinished fixtures to the day this script is RUN, in Malawi time.
-- Supabase -> SQL Editor -> New query -> paste this entire file -> Run.
-- Live matches: today. Scheduled matches: today onward, preserving day gaps
-- and kickoff times. Completed matches, scores, events, assignments and live
-- clock start timestamps are NOT changed. Undated fixtures stay undated.
-- Safe to repeat on the same day; running later intentionally rebases again.
-- The older extra fixture is brought to today rather than anchoring the
-- main fixture card several weeks away. Nothing is deleted or recreated.

begin;

with anchor as (
  select
    (now() at time zone 'Africa/Blantyre')::date as today,
    coalesce(
      min((scheduled_at at time zone 'Africa/Blantyre')::date)
        filter (where id::text like '01b20000-%'),
      min((scheduled_at at time zone 'Africa/Blantyre')::date)
    ) as first_day
  from public.matches
  where status in ('scheduled', 'live') and scheduled_at is not null
), plan as (
  select m.id,
    (
      (
        a.today + case when m.status = 'live' then 0 else greatest(
          0, (m.scheduled_at at time zone 'Africa/Blantyre')::date - a.first_day
        ) end
      ) + (m.scheduled_at at time zone 'Africa/Blantyre')::time
    ) at time zone 'Africa/Blantyre' as new_kickoff
  from public.matches m cross join anchor a
  where m.status in ('scheduled', 'live') and m.scheduled_at is not null
)
update public.matches m
set scheduled_at = p.new_kickoff
from plan p
where m.id = p.id
  and m.status in ('scheduled', 'live')
  and m.scheduled_at is distinct from p.new_kickoff;

-- Check the resulting active fixture list in Malawi local time.
select m.week,
  h.name as home_team,
  a.name as away_team,
  m.scheduled_at at time zone 'Africa/Blantyre' as kickoff_malawi,
  m.status
from public.matches m
left join public.teams h on h.id = m.home_team_id
left join public.teams a on a.id = m.away_team_id
where m.status in ('scheduled', 'live')
order by m.scheduled_at nulls last, m.week;

commit;
