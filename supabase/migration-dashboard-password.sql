-- =====================================================================
--  DASHBOARD PASSWORD
--  Adds the column that stores each member's 6-digit dashboard
--  password (SHA-256 hash, never the raw digits). The first time a
--  member taps "My dashboard" they create it; after that they must
--  enter it. Admins can reset it from the Users page.
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

alter table public.profiles
  add column if not exists dashboard_pin_hash text;
