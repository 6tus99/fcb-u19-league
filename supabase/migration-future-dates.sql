-- =====================================================================
--  FCB Under-19 League — move dummy fixtures to future dates
-- =====================================================================
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  What this does:
--   * Shifts all 32 seeded matches +49 days so the demo card
--     matches TODAY (Fri 13 Nov 2026):
--       Week 1: Sat 24 - Sun 25 Oct 2026  (finished)
--       Week 2: Sat 31 Oct - Sun 1 Nov 2026 (finished)
--       Week 3: Fri 13 Nov (LIVE today) + Sat 14 - Sun 15 Nov
--       Week 4: Sat 21 - Sun 22 Nov 2026  (scheduled)
--   * Scores, statuses, venues and events are untouched.
-- =====================================================================

-- 32 matches
update public.matches set scheduled_at = '2026-10-24 10:00+02' where id = '01b20000-0000-4000-8000-000000000001';
update public.matches set scheduled_at = '2026-10-24 13:00+02' where id = '01b20000-0000-4000-8000-000000000002';
update public.matches set scheduled_at = '2026-10-24 16:00+02' where id = '01b20000-0000-4000-8000-000000000003';
update public.matches set scheduled_at = '2026-10-25 10:00+02' where id = '01b20000-0000-4000-8000-000000000004';
update public.matches set scheduled_at = '2026-10-25 13:00+02' where id = '01b20000-0000-4000-8000-000000000005';
update public.matches set scheduled_at = '2026-10-25 16:00+02' where id = '01b20000-0000-4000-8000-000000000006';
update public.matches set scheduled_at = '2026-10-24 10:00+02' where id = '01b20000-0000-4000-8000-000000000007';
update public.matches set scheduled_at = '2026-10-24 13:00+02' where id = '01b20000-0000-4000-8000-000000000008';
update public.matches set scheduled_at = '2026-10-31 10:00+02' where id = '01b20000-0000-4000-8000-000000000009';
update public.matches set scheduled_at = '2026-10-31 13:00+02' where id = '01b20000-0000-4000-8000-000000000010';
update public.matches set scheduled_at = '2026-10-31 16:00+02' where id = '01b20000-0000-4000-8000-000000000011';
update public.matches set scheduled_at = '2026-11-01 10:00+02' where id = '01b20000-0000-4000-8000-000000000012';
update public.matches set scheduled_at = '2026-11-01 13:00+02' where id = '01b20000-0000-4000-8000-000000000013';
update public.matches set scheduled_at = '2026-11-01 16:00+02' where id = '01b20000-0000-4000-8000-000000000014';
update public.matches set scheduled_at = '2026-10-31 10:00+02' where id = '01b20000-0000-4000-8000-000000000015';
update public.matches set scheduled_at = '2026-10-31 13:00+02' where id = '01b20000-0000-4000-8000-000000000016';
update public.matches set scheduled_at = '2026-11-13 10:00+02' where id = '01b20000-0000-4000-8000-000000000017';
update public.matches set scheduled_at = '2026-11-14 10:00+02' where id = '01b20000-0000-4000-8000-000000000018';
update public.matches set scheduled_at = '2026-11-14 13:00+02' where id = '01b20000-0000-4000-8000-000000000019';
update public.matches set scheduled_at = '2026-11-14 16:00+02' where id = '01b20000-0000-4000-8000-000000000020';
update public.matches set scheduled_at = '2026-11-15 10:00+02' where id = '01b20000-0000-4000-8000-000000000021';
update public.matches set scheduled_at = '2026-11-15 13:00+02' where id = '01b20000-0000-4000-8000-000000000022';
update public.matches set scheduled_at = '2026-11-15 16:00+02' where id = '01b20000-0000-4000-8000-000000000023';
update public.matches set scheduled_at = '2026-11-14 10:00+02' where id = '01b20000-0000-4000-8000-000000000024';
update public.matches set scheduled_at = '2026-11-21 10:00+02' where id = '01b20000-0000-4000-8000-000000000025';
update public.matches set scheduled_at = '2026-11-21 13:00+02' where id = '01b20000-0000-4000-8000-000000000026';
update public.matches set scheduled_at = '2026-11-21 16:00+02' where id = '01b20000-0000-4000-8000-000000000027';
update public.matches set scheduled_at = '2026-11-22 10:00+02' where id = '01b20000-0000-4000-8000-000000000028';
update public.matches set scheduled_at = '2026-11-22 13:00+02' where id = '01b20000-0000-4000-8000-000000000029';
update public.matches set scheduled_at = '2026-11-22 16:00+02' where id = '01b20000-0000-4000-8000-000000000030';
update public.matches set scheduled_at = '2026-11-21 10:00+02' where id = '01b20000-0000-4000-8000-000000000031';
update public.matches set scheduled_at = '2026-11-21 13:00+02' where id = '01b20000-0000-4000-8000-000000000032';

-- Verify: shows the new fixture card
select week, scheduled_at, status, home_score, away_score
from public.matches order by scheduled_at;

-- News items: bump the 3 seeded stories to this week so the homepage
-- dates match the new fixture card (safe to re-run).
update public.news set created_at = '2026-11-13 08:00+02'
 where id = 'c43492a8-606e-44f4-8bf9-c844c09e7001';  -- Week 3 kicks off today
update public.news set created_at = '2026-11-12 09:00+02'
 where id = '0751e21e-e0f8-4aad-83bb-f6f3d35c1865';  -- top the table
update public.news set created_at = '2026-11-11 10:00+02'
 where id = 'ebc80586-a8ac-4e4b-8f06-e806cd86285c';  -- officials confirmed
