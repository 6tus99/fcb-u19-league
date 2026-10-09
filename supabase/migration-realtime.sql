-- Migration: enable Supabase Realtime for the tables the app listens to.
--
-- Why: browser pages can only receive "something changed" broadcasts for
-- tables that are members of the `supabase_realtime` publication. Without
-- this, the live-update subscriptions in the app stay silent and the UI
-- looks dead until you refresh.
--
-- Run this in the Supabase SQL Editor (Database → SQL). It is idempotent —
-- safe to run again, it only adds tables that are missing.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'pending_role_changes',
    'matches',
    'match_events',
    'teams'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
