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
