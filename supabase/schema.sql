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
  city text,
  stadium text,
  primary_color text not null default '#3b82f6',
  secondary_color text not null default '#ffffff',
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
-- Your 16 Blantyre teams
insert into public.teams (id, name, short_name, city, stadium, primary_color, secondary_color) values
  ('01b10000-0000-4000-8000-000000000001', 'CC Stars',                  'CCS', 'Blantyre', 'CC Stadium',              '#FF6B00', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000002', 'Rams United',               'RAM', 'Blantyre', 'Rams Park',               '#FFD700', '#000000'),
  ('01b10000-0000-4000-8000-000000000003', 'Agumbala Stars',            'AGS', 'Blantyre', 'Agumbala Ground',         '#00BFFF', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000004', 'Brothers in Arms FC',       'BIA', 'Blantyre', 'BIA Ground',              '#8B0000', '#FFD700'),
  ('01b10000-0000-4000-8000-000000000005', 'Nyambadwe United',          'NYU', 'Blantyre', 'Nyambadwe Stadium',       '#006400', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000006', 'Soche Madrid',              'SOC', 'Blantyre', 'Soche Ground',            '#FF0000', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000007', 'Yizo Yizo Warriors',        'YYW', 'Blantyre', 'Yizo Ground',             '#800080', '#FFD700'),
  ('01b10000-0000-4000-8000-000000000008', 'Bullets Youth',             'BLY', 'Blantyre', 'Kamuzu Stadium',          '#FF0000', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000009', 'Wanderers Youth',           'WAY', 'Blantyre', 'Kamuzu Stadium',          '#000080', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000010', 'Ekhaya Youth',              'EKH', 'Blantyre', 'Ekhaya Ground',           '#008080', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000011', 'Extending Hope FC',         'EHF', 'Blantyre', 'Hope Ground',             '#FF69B4', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000012', 'Ndirande Dotmond',          'NDD', 'Blantyre', 'Ndirande Ground',         '#FF4500', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000013', 'Griffin Young Stars',       'GYS', 'Blantyre', 'Griffin Ground',          '#2E8B57', '#FFD700'),
  ('01b10000-0000-4000-8000-000000000014', 'Machinjiri United',         'MJU', 'Blantyre', 'Machinjiri Ground',       '#4169E1', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000015', 'Airsport United',           'AIR', 'Blantyre', 'Airsport Ground',         '#00CED1', '#FFFFFF'),
  ('01b10000-0000-4000-8000-000000000016', 'Manchester Motor Spares FC','MMS', 'Blantyre', 'Motor Spares Ground',     '#FF6347', '#000000')
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

-- 16 teams = 8 matches per week. Weeks 1-2 finished, Week 3 has one live
-- match plus fixtures for the weekend, Week 4 scheduled.
insert into public.matches (id, home_team_id, away_team_id, week, scheduled_at, venue, status, home_score, away_score) values
  -- Week 1 (finished)
  ('01b20000-0000-4000-8000-000000000001', '01b10000-0000-4000-8000-000000000001','01b10000-0000-4000-8000-000000000002', 1, '2026-09-05 10:00+02', 'CC Stadium, Blantyre',       'finished', 2, 1),
  ('01b20000-0000-4000-8000-000000000002', '01b10000-0000-4000-8000-000000000003','01b10000-0000-4000-8000-000000000004', 1, '2026-09-05 13:00+02', 'Agumbala Ground, Blantyre',  'finished', 0, 0),
  ('01b20000-0000-4000-8000-000000000003', '01b10000-0000-4000-8000-000000000005','01b10000-0000-4000-8000-000000000006', 1, '2026-09-05 16:00+02', 'Nyambadwe Stadium, Blantyre','finished', 3, 1),
  ('01b20000-0000-4000-8000-000000000004', '01b10000-0000-4000-8000-000000000007','01b10000-0000-4000-8000-000000000008', 1, '2026-09-06 10:00+02', 'Yizo Ground, Blantyre',      'finished', 1, 2),
  ('01b20000-0000-4000-8000-000000000005', '01b10000-0000-4000-8000-000000000009','01b10000-0000-4000-8000-000000000010', 1, '2026-09-06 13:00+02', 'Kamuzu Stadium, Blantyre',   'finished', 1, 1),
  ('01b20000-0000-4000-8000-000000000006', '01b10000-0000-4000-8000-000000000011','01b10000-0000-4000-8000-000000000012', 1, '2026-09-06 16:00+02', 'Hope Ground, Blantyre',      'finished', 0, 2),
  ('01b20000-0000-4000-8000-000000000007', '01b10000-0000-4000-8000-000000000013','01b10000-0000-4000-8000-000000000014', 1, '2026-09-05 10:00+02', 'Griffin Ground, Blantyre',   'finished', 2, 0),
  ('01b20000-0000-4000-8000-000000000008', '01b10000-0000-4000-8000-000000000015','01b10000-0000-4000-8000-000000000016', 1, '2026-09-05 13:00+02', 'Airsport Ground, Blantyre',  'finished', 1, 0),
  -- Week 2 (finished)
  ('01b20000-0000-4000-8000-000000000009', '01b10000-0000-4000-8000-000000000001','01b10000-0000-4000-8000-000000000003', 2, '2026-09-12 10:00+02', 'CC Stadium, Blantyre',       'finished', 1, 0),
  ('01b20000-0000-4000-8000-000000000010', '01b10000-0000-4000-8000-000000000002','01b10000-0000-4000-8000-000000000007', 2, '2026-09-12 13:00+02', 'Rams Park, Blantyre',        'finished', 2, 2),
  ('01b20000-0000-4000-8000-000000000011', '01b10000-0000-4000-8000-000000000004','01b10000-0000-4000-8000-000000000005', 2, '2026-09-12 16:00+02', 'BIA Ground, Blantyre',       'finished', 1, 3),
  ('01b20000-0000-4000-8000-000000000012', '01b10000-0000-4000-8000-000000000006','01b10000-0000-4000-8000-000000000009', 2, '2026-09-13 10:00+02', 'Soche Ground, Blantyre',     'finished', 0, 1),
  ('01b20000-0000-4000-8000-000000000013', '01b10000-0000-4000-8000-000000000008','01b10000-0000-4000-8000-000000000011', 2, '2026-09-13 13:00+02', 'Kamuzu Stadium, Blantyre',   'finished', 2, 1),
  ('01b20000-0000-4000-8000-000000000014', '01b10000-0000-4000-8000-000000000010','01b10000-0000-4000-8000-000000000013', 2, '2026-09-13 16:00+02', 'Ekhaya Ground, Blantyre',    'finished', 1, 2),
  ('01b20000-0000-4000-8000-000000000015', '01b10000-0000-4000-8000-000000000012','01b10000-0000-4000-8000-000000000015', 2, '2026-09-12 10:00+02', 'Ndirande Ground, Blantyre',  'finished', 0, 0),
  ('01b20000-0000-4000-8000-000000000016', '01b10000-0000-4000-8000-000000000014','01b10000-0000-4000-8000-000000000016', 2, '2026-09-12 13:00+02', 'Machinjiri Ground, Blantyre','finished', 1, 1),
  -- Week 3 (one live today, rest this weekend)
  ('01b20000-0000-4000-8000-000000000017', '01b10000-0000-4000-8000-000000000001','01b10000-0000-4000-8000-000000000008', 3, '2026-09-25 10:00+02', 'CC Stadium, Blantyre',       'live',     2, 1),
  ('01b20000-0000-4000-8000-000000000018', '01b10000-0000-4000-8000-000000000002','01b10000-0000-4000-8000-000000000003', 3, '2026-09-26 10:00+02', 'Rams Park, Blantyre',        'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000019', '01b10000-0000-4000-8000-000000000007','01b10000-0000-4000-8000-000000000004', 3, '2026-09-26 13:00+02', 'Yizo Ground, Blantyre',      'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000020', '01b10000-0000-4000-8000-000000000005','01b10000-0000-4000-8000-000000000010', 3, '2026-09-26 16:00+02', 'Nyambadwe Stadium, Blantyre','scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000021', '01b10000-0000-4000-8000-000000000006','01b10000-0000-4000-8000-000000000013', 3, '2026-09-27 10:00+02', 'Soche Ground, Blantyre',     'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000022', '01b10000-0000-4000-8000-000000000009','01b10000-0000-4000-8000-000000000012', 3, '2026-09-27 13:00+02', 'Kamuzu Stadium, Blantyre',   'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000023', '01b10000-0000-4000-8000-000000000011','01b10000-0000-4000-8000-000000000014', 3, '2026-09-27 16:00+02', 'Hope Ground, Blantyre',      'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000024', '01b10000-0000-4000-8000-000000000015','01b10000-0000-4000-8000-000000000016', 3, '2026-09-26 10:00+02', 'Airsport Ground, Blantyre',  'scheduled', 0, 0),
  -- Week 4 (scheduled)
  ('01b20000-0000-4000-8000-000000000025', '01b10000-0000-4000-8000-000000000001','01b10000-0000-4000-8000-000000000004', 4, '2026-10-03 10:00+02', 'CC Stadium, Blantyre',       'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000026', '01b10000-0000-4000-8000-000000000002','01b10000-0000-4000-8000-000000000006', 4, '2026-10-03 13:00+02', 'Rams Park, Blantyre',        'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000027', '01b10000-0000-4000-8000-000000000003','01b10000-0000-4000-8000-000000000010', 4, '2026-10-03 16:00+02', 'Agumbala Ground, Blantyre',  'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000028', '01b10000-0000-4000-8000-000000000007','01b10000-0000-4000-8000-000000000011', 4, '2026-10-04 10:00+02', 'Yizo Ground, Blantyre',      'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000029', '01b10000-0000-4000-8000-000000000008','01b10000-0000-4000-8000-000000000012', 4, '2026-10-04 13:00+02', 'Kamuzu Stadium, Blantyre',   'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000030', '01b10000-0000-4000-8000-000000000009','01b10000-0000-4000-8000-000000000013', 4, '2026-10-04 16:00+02', 'Kamuzu Stadium, Blantyre',   'scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000031', '01b10000-0000-4000-8000-000000000005','01b10000-0000-4000-8000-000000000015', 4, '2026-10-03 10:00+02', 'Nyambadwe Stadium, Blantyre','scheduled', 0, 0),
  ('01b20000-0000-4000-8000-000000000032', '01b10000-0000-4000-8000-000000000014','01b10000-0000-4000-8000-000000000016', 4, '2026-10-03 13:00+02', 'Machinjiri Ground, Blantyre','scheduled', 0, 0)
on conflict (id) do nothing;

insert into public.match_events (match_id, minute, event_type, team_id, description) values
  -- Week 1
  ('01b20000-0000-4000-8000-000000000001', 12, 'goal',        '01b10000-0000-4000-8000-000000000001', 'Goal — Kondwani Phiri'),
  ('01b20000-0000-4000-8000-000000000001', 45, 'goal',        '01b10000-0000-4000-8000-000000000002', 'Goal — Saimon Gunga'),
  ('01b20000-0000-4000-8000-000000000001', 78, 'goal',        '01b10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda'),
  ('01b20000-0000-4000-8000-000000000002', 55, 'yellow_card', '01b10000-0000-4000-8000-000000000004', 'Yellow card — Phiri Chake'),
  ('01b20000-0000-4000-8000-000000000003', 15, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Mphatso Jere'),
  ('01b20000-0000-4000-8000-000000000003', 40, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Limbani Njaka'),
  ('01b20000-0000-4000-8000-000000000003', 60, 'goal',        '01b10000-0000-4000-8000-000000000006', 'Goal — Thoko Mvula'),
  ('01b20000-0000-4000-8000-000000000003', 85, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Mphatso Jere'),
  ('01b20000-0000-4000-8000-000000000004', 25, 'goal',        '01b10000-0000-4000-8000-000000000007', 'Goal — Chato Mwangoma'),
  ('01b20000-0000-4000-8000-000000000004', 50, 'goal',        '01b10000-0000-4000-8000-000000000008', 'Goal — Tiyamike Jere'),
  ('01b20000-0000-4000-8000-000000000004', 70, 'goal',        '01b10000-0000-4000-8000-000000000008', 'Goal — Bwera Ncube'),
  ('01b20000-0000-4000-8000-000000000005', 33, 'goal',        '01b10000-0000-4000-8000-000000000009', 'Goal — Gautham Chanda'),
  ('01b20000-0000-4000-8000-000000000005', 67, 'goal',        '01b10000-0000-4000-8000-000000000010', 'Goal — Khamiso Moyo'),
  ('01b20000-0000-4000-8000-000000000006', 20, 'goal',        '01b10000-0000-4000-8000-000000000012', 'Goal — Dipha Mwale'),
  ('01b20000-0000-4000-8000-000000000006', 58, 'goal',        '01b10000-0000-4000-8000-000000000012', 'Goal — Kondwani Genda'),
  ('01b20000-0000-4000-8000-000000000007', 10, 'goal',        '01b10000-0000-4000-8000-000000000013', 'Goal — Limbania Tembo'),
  ('01b20000-0000-4000-8000-000000000007', 74, 'goal',        '01b10000-0000-4000-8000-000000000013', 'Goal — Chipo Mwale'),
  ('01b20000-0000-4000-8000-000000000008', 44, 'goal',        '01b10000-0000-4000-8000-000000000015', 'Goal — Mercy Chirwa'),
  -- Week 2
  ('01b20000-0000-4000-8000-000000000009', 63, 'goal',        '01b10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda'),
  ('01b20000-0000-4000-8000-000000000010', 18, 'goal',        '01b10000-0000-4000-8000-000000000002', 'Goal — Saimon Gunga'),
  ('01b20000-0000-4000-8000-000000000010', 39, 'goal',        '01b10000-0000-4000-8000-000000000007', 'Goal — Chato Mwangoma'),
  ('01b20000-0000-4000-8000-000000000010', 55, 'goal',        '01b10000-0000-4000-8000-000000000002', 'Goal — Tiyamike Jere'),
  ('01b20000-0000-4000-8000-000000000010', 88, 'goal',        '01b10000-0000-4000-8000-000000000007', 'Goal — Phiri Kachale'),
  ('01b20000-0000-4000-8000-000000000011', 22, 'goal',        '01b10000-0000-4000-8000-000000000004', 'Goal — Phiri Chake'),
  ('01b20000-0000-4000-8000-000000000011', 41, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Limbani Njaka'),
  ('01b20000-0000-4000-8000-000000000011', 66, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Mphatso Jere'),
  ('01b20000-0000-4000-8000-000000000011', 90, 'goal',        '01b10000-0000-4000-8000-000000000005', 'Goal — Tanzy Phiri'),
  ('01b20000-0000-4000-8000-000000000012', 71, 'goal',        '01b10000-0000-4000-8000-000000000009', 'Goal — Gautham Chanda'),
  ('01b20000-0000-4000-8000-000000000013', 14, 'goal',        '01b10000-0000-4000-8000-000000000008', 'Goal — Tiyamike Jere'),
  ('01b20000-0000-4000-8000-000000000013', 49, 'goal',        '01b10000-0000-4000-8000-000000000011', 'Goal — Chisomo Moyo'),
  ('01b20000-0000-4000-8000-000000000013', 81, 'goal',        '01b10000-0000-4000-8000-000000000008', 'Goal — Bwera Ncube'),
  ('01b20000-0000-4000-8000-000000000014', 29, 'goal',        '01b10000-0000-4000-8000-000000000010', 'Goal — Khamiso Moyo'),
  ('01b20000-0000-4000-8000-000000000014', 52, 'goal',        '01b10000-0000-4000-8000-000000000013', 'Goal — Limbania Tembo'),
  ('01b20000-0000-4000-8000-000000000014', 77, 'goal',        '01b10000-0000-4000-8000-000000000013', 'Goal — Chipo Mwale'),
  ('01b20000-0000-4000-8000-000000000015', 61, 'red_card',    '01b10000-0000-4000-8000-000000000012', 'Red card — Kondwani Genda'),
  ('01b20000-0000-4000-8000-000000000016', 36, 'goal',        '01b10000-0000-4000-8000-000000000014', 'Goal — Mpho Banda'),
  ('01b20000-0000-4000-8000-000000000016', 59, 'goal',        '01b10000-0000-4000-8000-000000000016', 'Goal — Bwalya Tembo'),
  -- Week 3 (live match)
  ('01b20000-0000-4000-8000-000000000017', 23, 'goal',        '01b10000-0000-4000-8000-000000000001', 'Goal — Kondwani Phiri'),
  ('01b20000-0000-4000-8000-000000000017', 35, 'yellow_card', '01b10000-0000-4000-8000-000000000008', 'Yellow card — Tiyamike Jere'),
  ('01b20000-0000-4000-8000-000000000017', 47, 'goal',        '01b10000-0000-4000-8000-000000000008', 'Goal — Bwera Ncube'),
  ('01b20000-0000-4000-8000-000000000017', 61, 'goal',        '01b10000-0000-4000-8000-000000000001', 'Goal — Chikondi Banda')
on conflict do nothing;

insert into public.news (title, body) values
  ('Week 3 kicks off today — CC Stars host Bullets Youth',
   'The third round of the 2026 season begins today at CC Stadium as CC Stars host Bullets Youth, with the full Week 3 card taking place this weekend. Check the Matches page for kickoff times and venues.'),
  ('CC Stars, Nyambadwe United and Bullets Youth top the table',
   'After two rounds, CC Stars, Nyambadwe United and Bullets Youth all sit on six points. Mphatso Jere of Nyambadwe United leads the league with four goals, keeping the title race wide open heading into Week 3.'),
  ('Match officials confirmed for Week 4',
   'The league committee has confirmed officials for all eight Week 4 fixtures at the weekend. Officials can view their details in the Officials section of the admin dashboard.')
on conflict do nothing;
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  What this adds:
--   * public.requests  — manager "add player" requests and player
--     "transfer" requests, reviewed by the league admin.
--   * Approval trigger — when an admin approves, the player is added to
--     the team (or moved) automatically.
--   * Row-level security — managers can only request for their own team,
--     players can only transfer themselves, only admins resolve.
--   * Realtime — requests stream to connected dashboards.
-- =====================================================================

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('add_player', 'transfer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  from_team_id uuid references public.teams (id) on delete set null,
  player_profile_id uuid not null references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

-- -------------------------- row security ----------------------------
alter table public.requests enable row level security;

drop policy if exists "requests: view own, team, or all (admin)" on public.requests;
create policy "requests: view own, team, or all (admin)"
  on public.requests for select to authenticated
  using (
    public.has_role('{admin}')
    or requested_by = auth.uid()
    or (type = 'add_player'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.team_id = public.requests.team_id
        ))
  );

drop policy if exists "requests: managers add, players transfer" on public.requests;
create policy "requests: managers add, players transfer"
  on public.requests for insert to authenticated
  with check (
    (type = 'add_player'
      and public.has_role('{manager}')
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.team_id = public.requests.team_id
      ))
    or
    (type = 'transfer'
      and player_profile_id = auth.uid()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.team_id = public.requests.from_team_id
      ))
  );

drop policy if exists "requests: admins resolve" on public.requests;
create policy "requests: admins resolve"
  on public.requests for update to authenticated
  using (public.has_role('{admin}'))
  with check (public.has_role('{admin}'));

-- --------------------- approval trigger -----------------------------
-- When an admin sets status to approved/rejected, apply the effect.
create or replace function public.handle_request_resolution()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'pending' then
    return new;
  end if;

  new.resolved_at := coalesce(new.resolved_at, now());
  new.resolved_by := coalesce(new.resolved_by, auth.uid());

  if new.status = 'approved' then
    if new.type = 'add_player' then
      update public.profiles
         set team_id = new.team_id,
             role = case when role in ('fan', 'player') then 'player' else role end
       where id = new.player_profile_id;
    elsif new.type = 'transfer' then
      update public.profiles
         set team_id = new.team_id
       where id = new.player_profile_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_request_resolved on public.requests;
create trigger on_request_resolved
before update on public.requests
for each row execute function public.handle_request_resolution();

-- ----------------------- realtime -----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
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
-- ============================================================
-- Delete permissions for league admins (teams / matches / news /
-- officials). Idempotent: safe to run more than once.
-- Run in the Supabase SQL Editor.
-- (Deleting a USER is different — it needs the "delete-user"
-- Supabase function, because user logins live in a separate
-- system. See the app's Users page.)
-- ============================================================

drop policy if exists "admins delete teams" on public.teams;
create policy "admins delete teams" on public.teams for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete matches" on public.matches;
create policy "admins delete matches" on public.matches for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete news" on public.news;
create policy "admins delete news" on public.news for delete to authenticated
  using (public.has_role('{admin}'));

drop policy if exists "admins delete officials" on public.officials;
create policy "admins delete officials" on public.officials for delete to authenticated
  using (public.has_role('{admin}'));
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


-- =====================================================================
--  Appended: migration-social-betting-v2.sql (final: social + voice + betting)
-- =====================================================================
-- =====================================================================
--  FCB Under-19 — FINAL UPGRADE (replaces the earlier block)
--  NEWS SOCIAL (comments + EDIT + VOICE NOTES, one reaction per user)
--  + VIRTUAL-POINTS BETTING
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  What this does:
--   1. news_comments  — text (500 max) and/or a voice note;
--      you can edit and delete your own comments
--   2. news_reactions — 👍 / 🔥 / 👏 with ONE reaction per user
--      (tap a different one to switch, tap the same to remove)
--   3. voice-notes    — a Supabase Storage bucket where voice clips
--      are saved (each user's clips in their own folder)
--   4. betting        — virtual points only, never real money:
--      profiles.points (start 1,000), admin-set match odds, bets
--      table, atomic point deduction, auto-settlement when the
--      commissioner marks a match finished (+ bell notifications)
-- =====================================================================

-- ------------------- 1. NEWS: COMMENTS ----------------------------
create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text check (body is null or char_length(body) <= 500),
  voice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (coalesce(body, '') <> '' or voice_url is not null)
);
create index if not exists news_comments_news_created_idx
  on public.news_comments (news_id, created_at desc);

alter table public.news_comments enable row level security;
drop policy if exists "news comments: viewable" on public.news_comments;
create policy "news comments: viewable" on public.news_comments
  for select to authenticated using (true);
drop policy if exists "news comments: anyone can post" on public.news_comments;
create policy "news comments: anyone can post" on public.news_comments
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "news comments: edit own" on public.news_comments;
create policy "news comments: edit own" on public.news_comments
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "news comments: delete own" on public.news_comments;
create policy "news comments: delete own" on public.news_comments
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 2. NEWS: REACTIONS ---------------------------
create table if not exists public.news_reactions (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('like','fire','clap')),
  created_at timestamptz not null default now(),
  unique (news_id, user_id)
);
create index if not exists news_reactions_news_idx on public.news_reactions (news_id);

-- If an earlier version ever allowed several reactions per user,
-- keep only the most recent one so the unique rule can hold.
delete from public.news_reactions a
using public.news_reactions b
where a.news_id = b.news_id
  and a.user_id = b.user_id
  and a.created_at < b.created_at;

alter table public.news_reactions enable row level security;
drop policy if exists "news reactions: viewable" on public.news_reactions;
create policy "news reactions: viewable" on public.news_reactions
  for select to authenticated using (true);
drop policy if exists "news reactions: react" on public.news_reactions;
create policy "news reactions: react" on public.news_reactions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "news reactions: unreact" on public.news_reactions;
create policy "news reactions: unreact" on public.news_reactions
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 3. VOICE NOTES: STORAGE ----------------------
insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do update set public = true;

drop policy if exists "voice notes: insert own" on storage.objects;
create policy "voice notes: insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "voice notes: read" on storage.objects;
create policy "voice notes: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'voice-notes');

drop policy if exists "voice notes: delete own" on storage.objects;
create policy "voice notes: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------- 4. BETTING: ODDS + POINTS --------------------
alter table public.matches
  add column if not exists home_odds numeric check (home_odds is null or home_odds >= 1.01);
alter table public.matches
  add column if not exists draw_odds numeric check (draw_odds is null or draw_odds >= 1.01);
alter table public.matches
  add column if not exists away_odds numeric check (away_odds is null or away_odds >= 1.01);

alter table public.profiles
  add column if not exists points integer not null default 1000;

-- ------------------- 5. BETTING: BETS TABLE -----------------------
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  pick text not null check (pick in ('home','draw','away')),
  odds numeric not null check (odds >= 1.01),
  stake integer not null check (stake > 0 and stake <= 10000),
  status text not null default 'open' check (status in ('open','won','lost')),
  payout integer,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists bets_user_placed_idx on public.bets (user_id, placed_at desc);
create index if not exists bets_match_status_idx on public.bets (match_id, status);

alter table public.bets enable row level security;
drop policy if exists "bets: view own or admin" on public.bets;
create policy "bets: view own or admin" on public.bets
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('{admin}'));
drop policy if exists "bets: place own" on public.bets;
create policy "bets: place own" on public.bets
  for insert to authenticated with check (user_id = auth.uid());

-- ------------------- 6. DEDUCT POINTS AT PLACEMENT ----------------
create or replace function public.handle_bet_placed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set points = points - new.stake
   where id = new.user_id
     and points >= new.stake;
  if not found then
    raise exception 'Not enough points to place this bet.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_bet_placed on public.bets;
create trigger on_bet_placed
before insert on public.bets
for each row execute function public.handle_bet_placed();

-- ------------------- 7. SETTLE BETS WHEN MATCH FINISHES -----------
create or replace function public.settle_match_bets(p_match uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_home int;
  v_away int;
  v_winner text;
  v_teams text;
  v_bet public.bets%rowtype;
begin
  select home_score, away_score
    into v_home, v_away
    from public.matches
   where id = p_match;
  if v_home is null then
    return;
  end if;

  if v_home > v_away then
    v_winner := 'home';
  elsif v_home < v_away then
    v_winner := 'away';
  else
    v_winner := 'draw';
  end if;

  select t1.name || ' vs ' || t2.name into v_teams
    from public.matches m
    join public.teams t1 on t1.id = m.home_team_id
    join public.teams t2 on t2.id = m.away_team_id
   where m.id = p_match;

  update public.bets b
     set status = case when b.pick = v_winner then 'won' else 'lost' end,
         payout = case when b.pick = v_winner then round(b.stake * b.odds)::int end,
         settled_at = now()
   where b.match_id = p_match
     and b.status = 'open';

  for v_bet in select * from public.bets
                where match_id = p_match
                  and status in ('won', 'lost')
                  and settled_at >= now() - interval '5 minutes'
  loop
    if v_bet.status = 'won' then
      update public.profiles
         set points = points + v_bet.payout
       where id = v_bet.user_id;
    end if;

    perform public.notify_users(
      array[v_bet.user_id],
      case when v_bet.status = 'won'
           then 'Bet won: +' || v_bet.payout || ' points'
           else 'Bet settled: -' || v_bet.stake || ' points' end,
      'Your ' || v_bet.pick || ' bet (' || v_bet.stake || ' pts @ ' || v_bet.odds ||
        ') on ' || coalesce(v_teams, 'the match') || ' has been settled.',
      '/fan/betting'
    );
  end loop;
end;
$$;

create or replace function public.handle_match_settled()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.settle_match_bets(new.id);
  return new;
end;
$$;

drop trigger if exists on_match_finished_settle on public.matches;
create trigger on_match_finished_settle
after update on public.matches
for each row
when (new.status = 'finished' and old.status is distinct from 'finished')
execute function public.handle_match_settled();

-- ------------------- 8. REALTIME ----------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['bets', 'news_comments', 'news_reactions']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- =====================================================================
--  Appended: migration-editor-news.sql (editor role + rich news + polls)
-- =====================================================================
-- =====================================================================
--  FCB Under-19 — UPGRADE: EDITOR ROLE + RICH NEWS
--  (stories with pictures, videos and polls)
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
--
--  1. A new role: editor — granted by the admin with a code, like the
--     others. Editors publish news; they don't touch anything else.
--  2. News rows can carry an image, a video and a poll.
--  3. Polls: one vote per fan, fans can change their vote, counts are
--     live (realtime + auto-refresh).
--  4. A public storage bucket (news-media) holds pictures/videos.
-- =====================================================================

-- ------------------- 1. NEW ROLE: EDITOR --------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','commissioner','manager','player','fan','editor'));

alter table public.pending_role_changes drop constraint if exists pending_role_changes_new_role_check;
alter table public.pending_role_changes add constraint pending_role_changes_new_role_check
  check (new_role in ('admin','commissioner','manager','player','fan','editor'));

-- ------------------- 2. NEWS: MEDIA + POLL COLUMNS ----------------
alter table public.news add column if not exists image_url text;
alter table public.news add column if not exists video_url text;
alter table public.news add column if not exists poll_options text[];

-- ------------------- 3. NEWS: POLL VOTES --------------------------
create table if not exists public.news_poll_votes (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option text not null,
  created_at timestamptz not null default now(),
  unique (news_id, user_id)
);
create index if not exists news_poll_votes_news_idx on public.news_poll_votes (news_id);

alter table public.news_poll_votes enable row level security;
drop policy if exists "poll votes: viewable" on public.news_poll_votes;
create policy "poll votes: viewable" on public.news_poll_votes
  for select to authenticated using (true);
drop policy if exists "poll votes: one per fan" on public.news_poll_votes;
create policy "poll votes: one per fan" on public.news_poll_votes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "poll votes: change own" on public.news_poll_votes;
create policy "poll votes: change own" on public.news_poll_votes
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 4. NEWS: EDITORS MANAGE ----------------------
drop policy if exists "admins and commissioners manage news" on public.news;
create policy "admins, commissioners and editors manage news" on public.news
  for all to authenticated
  using (public.has_role('{admin,commissioner,editor}'))
  with check (public.has_role('{admin,commissioner,editor}'));

-- ------------------- 5. STORAGE: NEWS MEDIA -----------------------
insert into storage.buckets (id, name, public)
values ('news-media', 'news-media', true)
on conflict (id) do update set public = true;

drop policy if exists "news media: editors upload" on storage.objects;
create policy "news media: editors upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'news-media'
    and public.has_role('{admin,commissioner,editor}')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "news media: viewable" on storage.objects;
create policy "news media: viewable" on storage.objects
  for select to authenticated using (bucket_id = 'news-media');

drop policy if exists "news media: delete own" on storage.objects;
create policy "news media: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'news-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------- 6. REALTIME -----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'news_poll_votes'
  ) then
    alter publication supabase_realtime add table public.news_poll_votes;
  end if;
end
$$;

-- =====================================================================
--  Appended: migration-fixtures-officials-logo.sql (fixtures + officials + logo)
-- =====================================================================
-- =====================================================================
--  FULL FIXTURES + OFFICIAL ASSIGNMENTS + LEAGUE LOGO
--  1) match date becomes optional -> generated matches show "Date TBC"
--  2) matches.referee_id + rule: an official is locked to one match
--     until that match has ended (they can be moved freely before it
--     starts, because the app clears the old assignment first)
--  3) 'commissioner' becomes a valid official type
--  4) public bucket 'app-assets' for the league logo
--  5) league_settings readable when logged out (logo on landing page)
-- =====================================================================

-- 1. undated fixtures
alter table public.matches alter column scheduled_at drop not null;

-- 2. official assignment
alter table public.matches add column if not exists referee_id uuid
  references public.officials (id) on delete set null;

create or replace function public.check_official_availability()
returns trigger
language plpgsql
as $$
declare n int;
begin
  if new.referee_id is null then
    return new;
  end if;
  select count(*) into n from public.matches
    where referee_id = new.referee_id
      and id is distinct from new.id
      and status <> 'finished';
  if n > 0 then
    raise exception 'That official is still assigned to another match that has not ended. Remove them from that match first, or assign them once it has ended.';
  end if;
  return new;
end
$$;

drop trigger if exists trg_official_availability on public.matches;
create trigger trg_official_availability
  before insert or update of referee_id on public.matches
  for each row execute function public.check_official_availability();

-- 3. commissioner as an official type
alter table public.officials drop constraint if exists officials_type_check;
alter table public.officials add constraint officials_type_check
  check (type in ('referee', 'assistant_referee', 'commissioner'));

-- 4. logo bucket (public read; only admins upload/delete)
insert into storage.buckets (id, name, public) values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;
drop policy if exists "app assets upload admin" on storage.objects;
create policy "app assets upload admin" on storage.objects
  for insert with check (bucket_id = 'app-assets' and public.has_role('{admin}'));
drop policy if exists "app assets public read" on storage.objects;
create policy "app assets public read" on storage.objects
  for select using (bucket_id = 'app-assets');
drop policy if exists "app assets delete admin" on storage.objects;
create policy "app assets delete admin" on storage.objects
  for delete using (bucket_id = 'app-assets' and public.has_role('{admin}'));

-- 5. settings readable by everyone (so the logo shows before login)
drop policy if exists "settings are viewable" on public.league_settings;
create policy "settings are viewable" on public.league_settings
  for select using (true);

-- =====================================================================
--  Appended: migration-match-notifications.sql (match event notifications)
-- =====================================================================
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

-- =====================================================================
--  Appended: migration-social-feed.sql (social feed + gifts + messages)
-- =====================================================================
-- =====================================================================
--  SOCIAL FEED + GIFTS + MESSAGING
--  - posts         — text and/or a photo or video (public bucket)
--  - post_likes    — one heart per user, tap again to remove
--  - post_comments — short comments under posts
--  - gifts         — send a virtual gift to another member; points
--                    move from your wallet to theirs (the FCB Bank
--                    money integration plugs into this later)
--  - messages      — 1-on-1 chat, real-time, photo attachments
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

-- ------------------- 0. POINTS WALLET (if v2 not run yet) ----------
alter table public.profiles
  add column if not exists points integer not null default 1000;

-- ------------------- 1. POSTS ---------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text check (body is null or char_length(body) <= 1000),
  media_url text,
  media_type text check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  check (coalesce(body, '') <> '' or media_url is not null)
);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
drop policy if exists "posts: viewable" on public.posts;
create policy "posts: viewable" on public.posts
  for select to authenticated using (true);
drop policy if exists "posts: post own" on public.posts;
create policy "posts: post own" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "posts: edit own" on public.posts;
create policy "posts: edit own" on public.posts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 2. LIKES ---------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

alter table public.post_likes enable row level security;
drop policy if exists "post likes: viewable" on public.post_likes;
create policy "post likes: viewable" on public.post_likes
  for select to authenticated using (true);
drop policy if exists "post likes: like" on public.post_likes;
create policy "post likes: like" on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "post likes: unlike" on public.post_likes;
create policy "post likes: unlike" on public.post_likes
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 3. COMMENTS ------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;
drop policy if exists "post comments: viewable" on public.post_comments;
create policy "post comments: viewable" on public.post_comments
  for select to authenticated using (true);
drop policy if exists "post comments: post own" on public.post_comments;
create policy "post comments: post own" on public.post_comments
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "post comments: delete own" on public.post_comments;
create policy "post comments: delete own" on public.post_comments
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 4. GIFTS ---------------------------------------
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  gift_type text not null check (gift_type in ('ball','fire','star','trophy')),
  points integer not null check (points > 0),
  message text check (message is null or char_length(message) <= 200),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists gifts_to_created_idx on public.gifts (to_id, created_at desc);
create index if not exists gifts_from_created_idx on public.gifts (from_id, created_at desc);

alter table public.gifts enable row level security;
drop policy if exists "gifts: view own" on public.gifts;
create policy "gifts: view own" on public.gifts
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "gifts: send own" on public.gifts;
create policy "gifts: send own" on public.gifts
  for insert to authenticated with check (from_id = auth.uid());

-- Gift costs (virtual points — real money comes with the bank
-- integration later). The trigger is the single source of truth.
create or replace function public.gift_cost(p_type text)
returns integer
language sql immutable as $$
  select case p_type
    when 'ball'   then 50
    when 'fire'   then 100
    when 'star'   then 250
    when 'trophy' then 500
    else 100 end;
$$;

create or replace function public.handle_gift_sent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cost int;
  v_from text;
begin
  v_cost := public.gift_cost(new.gift_type);
  new.points := v_cost;

  -- sender must be able to pay
  update public.profiles
     set points = points - v_cost
   where id = new.from_id
     and points >= v_cost;
  if not found then
    raise exception 'Not enough points for this gift (needs % points).', v_cost;
  end if;

  -- receiver gets the points
  update public.profiles
     set points = points + v_cost
   where id = new.to_id;

  select full_name into v_from from public.profiles where id = new.from_id;
  perform public.notify_users(array[new.to_id],
    'Gift received',
    coalesce(v_from, 'Someone') || ' sent you the ' || new.gift_type ||
      ' gift (' || v_cost || ' points).' ||
      coalesce(' "' || new.message || '"', ''),
    '/social');

  return new;
end
$$;

drop trigger if exists on_gift_sent on public.gifts;
create trigger on_gift_sent
  before insert on public.gifts
  for each row execute function public.handle_gift_sent();

-- ------------------- 5. MESSAGES ------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text check (body is null or char_length(body) <= 1000),
  media_url text,
  media_type text check (media_type in ('image','video')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check (coalesce(body, '') <> '' or media_url is not null)
);
create index if not exists messages_pair_created_idx
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index if not exists messages_unread_idx
  on public.messages (recipient_id, read_at) where read_at is null;

alter table public.messages enable row level security;
drop policy if exists "messages: view thread" on public.messages;
create policy "messages: view thread" on public.messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "messages: send own" on public.messages;
create policy "messages: send own" on public.messages
  for insert to authenticated with check (sender_id = auth.uid());
drop policy if exists "messages: mark own read" on public.messages;
create policy "messages: mark own read" on public.messages
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists "messages: delete own sent" on public.messages;
create policy "messages: delete own sent" on public.messages
  for delete to authenticated using (sender_id = auth.uid());

-- Bell notification when a message arrives
create or replace function public.handle_message_sent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_from text;
begin
  select full_name into v_from from public.profiles where id = new.sender_id;
  perform public.notify_users(array[new.recipient_id],
    'New message from ' || coalesce(v_from, 'Someone'),
    case when new.body is not null then left(new.body, 80)
         else 'They sent you a photo.' end,
    '/messages/' || new.sender_id);
  return new;
end
$$;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
  after insert on public.messages
  for each row execute function public.handle_message_sent();

-- ------------------- 6. STORAGE: SOCIAL MEDIA ------------------------
insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do update set public = true;

drop policy if exists "social media: insert own" on storage.objects;
create policy "social media: insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "social media: read" on storage.objects;
create policy "social media: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'social-media');

drop policy if exists "social media: delete own" on storage.objects;
create policy "social media: delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------- 7. REALTIME -------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['posts','post_likes','post_comments','gifts','messages']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- =====================================================================
--  Appended: migration-dashboard-password.sql
-- =====================================================================
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

-- =====================================================================
--  Appended: migration-match-foul-event.sql (foul event type + notification)
-- =====================================================================
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

-- =====================================================================
--  Appended: migration-live-clock.sql (live clock + foul re-run)
-- =====================================================================
-- =====================================================================
--  LIVE MATCH CLOCK + FOUL EVENT TYPE
--  1) matches.live_started_at — when "Start match" is pressed, the
--     app stores this moment and the on-screen clock runs from it.
--     Clock rules: 1st half 0:00 -> 40:00 (auto-stops at 40:00);
--     2nd half restarts from 0:00 when "2nd half begins" is recorded;
--     after 40:00 in the 2nd half it counts added time automatically
--     (40+0:01, 40+0:02…) before or without entering added time.
--  2) Re-runs the foul event type + notification (safe to re-run even
--     if you already ran it).
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

alter table public.matches
  add column if not exists live_started_at timestamptz;

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
