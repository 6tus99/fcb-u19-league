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
