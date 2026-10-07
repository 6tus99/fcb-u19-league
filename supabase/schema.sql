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
