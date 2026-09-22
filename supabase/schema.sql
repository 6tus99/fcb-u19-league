-- =====================================================================
--  FCB Under 19 Football League — Supabase one-shot setup
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

create extension if not exists pgcrypto;

-- ------------------------------ tables -----------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  color text not null default '#3b82f6',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'fan' check (role in ('admin','commissioner','manager','player','fan')),
  team_id uuid references public.teams (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  home_team_id uuid not null references public.teams (id) on delete cascade,
  away_team_id uuid not null references public.teams (id) on delete cascade,
  week int not null default 1,
  scheduled_at timestamptz not null,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  home_score int not null default 0,
  away_score int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  minute int,
  event_type text not null check (event_type in ('goal','yellow_card','red_card','substitution','note')),
  team_id uuid references public.teams (id) on delete set null,
  player_id uuid references public.profiles (id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.officials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'referee' check (type in ('referee','assistant_referee')),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.league_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- --------------------- auth -> profile triggers ---------------------
-- Automatically create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_team uuid;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'fan');
  -- only fan/manager/player can be self-assigned; admin/commissioner are
  -- granted later by an admin (or via the first-user rule below)
  if v_role not in ('manager', 'player') then
    v_role := 'fan';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'team_id', '') ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then
    v_team := (new.raw_user_meta_data ->> 'team_id')::uuid;
  end if;
  insert into public.profiles (id, email, full_name, role, team_id)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
          v_role, v_team)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- The very first user to ever register becomes the league Admin.
create or replace function public.first_user_is_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles) then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_first_user_is_admin on public.profiles;
create trigger profiles_first_user_is_admin
before insert on public.profiles
for each row execute function public.first_user_is_admin();

-- --------------------------- role helper ----------------------------
create or replace function public.has_role(allowed text[])
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (allowed)
  );
$$;

-- -------------------------- row security ----------------------------
alter table public.teams           enable row level security;
alter table public.profiles        enable row level security;
alter table public.matches         enable row level security;
alter table public.match_events    enable row level security;
alter table public.news            enable row level security;
alter table public.officials       enable row level security;
alter table public.league_settings enable row level security;

drop policy if exists "profiles are viewable by authenticated users" on public.profiles;
create policy "profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users manage own profile, admins manage all" on public.profiles;
create policy "users manage own profile, admins manage all"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role('{admin}'))
  with check (id = auth.uid() or public.has_role('{admin}'));

drop policy if exists "teams are viewable" on public.teams;
create policy "teams are viewable" on public.teams for select to authenticated using (true);

drop policy if exists "admins manage teams" on public.teams;
create policy "admins manage teams" on public.teams for all to authenticated
  using (public.has_role('{admin}')) with check (public.has_role('{admin}'));

drop policy if exists "matches are viewable" on public.matches;
create policy "matches are viewable" on public.matches for select to authenticated using (true);

drop policy if exists "admins and commissioners manage matches" on public.matches;
create policy "admins and commissioners manage matches" on public.matches for all to authenticated
  using (public.has_role('{admin,commissioner}'))
  with check (public.has_role('{admin,commissioner}'));

drop policy if exists "match events are viewable" on public.match_events;
create policy "match events are viewable" on public.match_events for select to authenticated using (true);

drop policy if exists "admins and commissioners manage match events" on public.match_events;
create policy "admins and commissioners manage match events" on public.match_events for all to authenticated
  using (public.has_role('{admin,commissioner}'))
  with check (public.has_role('{admin,commissioner}'));

drop policy if exists "news is viewable" on public.news;
create policy "news is viewable" on public.news for select to authenticated using (true);

drop policy if exists "admins and commissioners manage news" on public.news;
create policy "admins and commissioners manage news" on public.news for all to authenticated
  using (public.has_role('{admin,commissioner}'))
  with check (public.has_role('{admin,commissioner}'));

drop policy if exists "officials are viewable" on public.officials;
create policy "officials are viewable" on public.officials for select to authenticated using (true);

drop policy if exists "admins manage officials" on public.officials;
create policy "admins manage officials" on public.officials for all to authenticated
  using (public.has_role('{admin}')) with check (public.has_role('{admin}'));

drop policy if exists "settings are viewable" on public.league_settings;
create policy "settings are viewable" on public.league_settings for select to authenticated using (true);

drop policy if exists "admins manage settings" on public.league_settings;
create policy "admins manage settings" on public.league_settings for all to authenticated
  using (public.has_role('{admin}')) with check (public.has_role('{admin}'));

-- ------------------- realtime for live scores -----------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches') then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_events') then
    alter publication supabase_realtime add table public.match_events;
  end if;
end $$;

-- ---------------------------- seed data -----------------------------
insert into public.teams (id, name, short_name, color) values
  ('01a10000-0000-4000-8000-000000000001', 'Blantyre City U19',    'BLA', '#e11d48'),
  ('01a10000-0000-4000-8000-000000000002', 'Lilongwe Kings U19',   'LIL', '#f59e0b'),
  ('01a10000-0000-4000-8000-000000000003', 'Zomba Warriors U19',   'ZOM', '#22c55e'),
  ('01a10000-0000-4000-8000-000000000004', 'Mzuzu Thunder U19',    'MZU', '#3b82f6'),
  ('01a10000-0000-4000-8000-000000000005', 'Karonga Flames U19',   'KAR', '#ef4444'),
  ('01a10000-0000-4000-8000-000000000006', 'Nkhata Bay Waves U19', 'NKB', '#06b6d4'),
  ('01a10000-0000-4000-8000-000000000007', 'Mangochi Strikers U19','MNG', '#8b5cf6'),
  ('01a10000-0000-4000-8000-000000000008', 'Kasungu Falcons U19',  'KAS', '#14b8a6')
on conflict (id) do nothing;

insert into public.league_settings (key, value) values
  ('league_name', 'FCB Under 19 Football League'),
  ('season', '2026 Season')
on conflict (key) do update set value = excluded.value;

insert into public.officials (name, type, phone) values
  ('Chisomo Phiri',   'referee',            null),
  ('Tadala Mwanza',   'referee',            null),
  ('Bwalya Tembo',    'referee',            null),
  ('Grace Kachale',   'assistant_referee',  null),
  ('Mercy Chirwa',    'assistant_referee',  null)
on conflict do nothing;

insert into public.matches (id, home_team_id, away_team_id, week, scheduled_at, venue, status, home_score, away_score) values
  -- Week 1 (finished)
  ('01a20000-0000-4000-8000-000000000001', '01a10000-0000-4000-8000-000000000001','01a10000-0000-4000-8000-000000000002', 1, '2026-08-29 10:00+02', 'Buku Sports Stadium, Blantyre',  'finished', 3, 1),
  ('01a20000-0000-4000-8000-000000000002', '01a10000-0000-4000-8000-000000000003','01a10000-0000-4000-8000-000000000004', 1, '2026-08-29 13:00+02', 'Nyasa Park, Blantyre',         'finished', 2, 2),
  ('01a20000-0000-4000-8000-000000000003', '01a10000-0000-4000-8000-000000000005','01a10000-0000-4000-8000-000000000006', 1, '2026-08-30 10:00+02', 'Kamuzu Stadium, Lilongwe',     'finished', 0, 2),
  ('01a20000-0000-4000-8000-000000000004', '01a10000-0000-4000-8000-000000000007','01a10000-0000-4000-8000-000000000008', 1, '2026-08-30 13:00+02', 'Luozi National Stadium, Lilongwe','finished', 1, 0),
  -- Week 2 (finished)
  ('01a20000-0000-4000-8000-000000000005', '01a10000-0000-4000-8000-000000000001','01a10000-0000-4000-8000-000000000003', 2, '2026-09-05 10:00+02', 'Buku Sports Stadium, Blantyre','finished', 2, 0),
  ('01a20000-0000-4000-8000-000000000006', '01a10000-0000-4000-8000-000000000002','01a10000-0000-4000-8000-000000000004', 2, '2026-09-05 13:00+02', 'Kamuzu Stadium, Lilongwe',    'finished', 3, 2),
  ('01a20000-0000-4000-8000-000000000007', '01a10000-0000-4000-8000-000000000006','01a10000-0000-4000-8000-000000000008', 2, '2026-09-06 10:00+02', 'Nkhata Bay Sports Ground',    'finished', 1, 1),
  ('01a20000-0000-4000-8000-000000000008', '01a10000-0000-4000-8000-000000000007','01a10000-0000-4000-8000-000000000005', 2, '2026-09-06 13:00+02', 'Luozi National Stadium, Lilongwe','finished', 2, 1),
  -- Week 3 (one live, three scheduled)
  ('01a20000-0000-4000-8000-000000000009', '01a10000-0000-4000-8000-000000000001','01a10000-0000-4000-8000-000000000005', 3, '2026-09-22 10:00+02', 'Buku Sports Stadium, Blantyre',  'live',     2, 0),
  ('01a20000-0000-4000-8000-000000000010', '01a10000-0000-4000-8000-000000000002','01a10000-0000-4000-8000-000000000003', 3, '2026-09-22 13:00+02', 'Kamuzu Stadium, Lilongwe',     'scheduled', 0, 0),
  ('01a20000-0000-4000-8000-000000000011', '01a10000-0000-4000-8000-000000000004','01a10000-0000-4000-8000-000000000006', 3, '2026-09-23 10:00+02', 'Mzuzu City Ground',            'scheduled', 0, 0),
  ('01a20000-0000-4000-8000-000000000012', '01a10000-0000-4000-8000-000000000007','01a10000-0000-4000-8000-000000000008', 3, '2026-09-23 13:00+02', 'Mangochi District Ground',     'scheduled', 0, 0),
  -- Week 4 (scheduled)
  ('01a20000-0000-4000-8000-000000000013', '01a10000-0000-4000-8000-000000000005','01a10000-0000-4000-8000-000000000006', 4, '2026-09-29 10:00+02', 'Kamuzu Stadium, Lilongwe',     'scheduled', 0, 0),
  ('01a20000-0000-4000-8000-000000000014', '01a10000-0000-4000-8000-000000000001','01a10000-0000-4000-8000-000000000002', 4, '2026-09-29 13:00+02', 'Buku Sports Stadium, Blantyre','scheduled', 0, 0),
  ('01a20000-0000-4000-8000-000000000015', '01a10000-0000-4000-8000-000000000003','01a10000-0000-4000-8000-000000000007', 4, '2026-09-30 10:00+02', 'Nyasa Park, Blantyre',         'scheduled', 0, 0),
  ('01a20000-0000-4000-8000-000000000016', '01a10000-0000-4000-8000-000000000004','01a10000-0000-4000-8000-000000000008', 4, '2026-09-30 13:00+02', 'Mzuzu City Ground',            'scheduled', 0, 0)
on conflict (id) do nothing;

insert into public.match_events (match_id, minute, event_type, team_id, description) values
  ('01a20000-0000-4000-8000-000000000001', 12, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda'),
  ('01a20000-0000-4000-8000-000000000001', 34, 'yellow_card', '01a10000-0000-4000-8000-000000000002', 'Yellow card — Dipha Mwale'),
  ('01a20000-0000-4000-8000-000000000001', 45, 'goal',        '01a10000-0000-4000-8000-000000000002', 'Goal — Tiyamike Jere'),
  ('01a20000-0000-4000-8000-000000000001', 67, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda'),
  ('01a20000-0000-4000-8000-000000000001', 78, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Limbani Njaka'),
  ('01a20000-0000-4000-8000-000000000001', 85, 'red_card',    '01a10000-0000-4000-8000-000000000002', 'Red card — Mphatso Kachale'),
  ('01a20000-0000-4000-8000-000000000002', 23, 'goal',        '01a10000-0000-4000-8000-000000000003', 'Goal — Tanzy Phiri'),
  ('01a20000-0000-4000-8000-000000000002', 51, 'goal',        '01a10000-0000-4000-8000-000000000004', 'Goal — Chato Mwangoma'),
  ('01a20000-0000-4000-8000-000000000002', 60, 'goal',        '01a10000-0000-4000-8000-000000000004', 'Goal — Mpho Banda'),
  ('01a20000-0000-4000-8000-000000000002', 88, 'goal',        '01a10000-0000-4000-8000-000000000003', 'Goal — Tanzy Phiri'),
  ('01a20000-0000-4000-8000-000000000003', 40, 'goal',        '01a10000-0000-4000-8000-000000000006', 'Goal — Khamiso Chanda'),
  ('01a20000-0000-4000-8000-000000000003', 74, 'goal',        '01a10000-0000-4000-8000-000000000006', 'Goal — Chisomo Moyo'),
  ('01a20000-0000-4000-8000-000000000004', 55, 'goal',        '01a10000-0000-4000-8000-000000000007', 'Goal — Limbania Tembo'),
  ('01a20000-0000-4000-8000-000000000005', 19, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda'),
  ('01a20000-0000-4000-8000-000000000005', 72, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Mphatso Jere'),
  ('01a20000-0000-4000-8000-000000000006', 8,  'goal',        '01a10000-0000-4000-8000-000000000002', 'Goal — Tiyamike Jere'),
  ('01a20000-0000-4000-8000-000000000006', 33, 'goal',        '01a10000-0000-4000-8000-000000000004', 'Goal — Chato Mwangoma'),
  ('01a20000-0000-4000-8000-000000000006', 57, 'goal',        '01a10000-0000-4000-8000-000000000002', 'Goal — Dipha Mwale'),
  ('01a20000-0000-4000-8000-000000000006', 81, 'goal',        '01a10000-0000-4000-8000-000000000002', 'Goal — Tiyamike Jere'),
  ('01a20000-0000-4000-8000-000000000006', 90, 'goal',        '01a10000-0000-4000-8000-000000000004', 'Goal — Mpho Banda'),
  ('01a20000-0000-4000-8000-000000000007', 27, 'goal',        '01a10000-0000-4000-8000-000000000006', 'Goal — Khamiso Chanda'),
  ('01a20000-0000-4000-8000-000000000007', 66, 'goal',        '01a10000-0000-4000-8000-000000000008', 'Goal — Bwera Ncube'),
  ('01a20000-0000-4000-8000-000000000008', 44, 'goal',        '01a10000-0000-4000-8000-000000000007', 'Goal — Limbania Tembo'),
  ('01a20000-0000-4000-8000-000000000008', 50, 'goal',        '01a10000-0000-4000-8000-000000000005', 'Goal — Kondwani Genda'),
  ('01a20000-0000-4000-8000-000000000008', 79, 'goal',        '01a10000-0000-4000-8000-000000000007', 'Goal — Chipo Mwale'),
  ('01a20000-0000-4000-8000-000000000009', 18, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Limbani Njaka'),
  ('01a20000-0000-4000-8000-000000000009', 31, 'yellow_card', '01a10000-0000-4000-8000-000000000005', 'Yellow card — Kondwani Genda'),
  ('01a20000-0000-4000-8000-000000000009', 47, 'goal',        '01a10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda')
on conflict do nothing;

insert into public.news (title, body) values
  ('Week 3 kicks off this weekend',
   'The third round of the 2026 season begins Saturday at Buku Sports Stadium as Blantyre City host Karonga Flames. Full schedules and venue details are on the Matches page.'),
  ('Blantyre City top the table after two wins',
   'Blantyre City sit top of the league with six points from two matches after a 2-0 win over Zomba Warriors last weekend. Chikondi Banda and Tiyamike Jere share the top scorer spot with three goals each.'),
  ('Match officials confirmed for Week 4',
   'The league committee has confirmed officials for all four Week 4 fixtures. Officials can view their details in the Officials section of the admin dashboard.')
on conflict do nothing;
