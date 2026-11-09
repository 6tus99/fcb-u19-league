-- =====================================================================
--  SOCIAL REACTIONS + VOICE COMMENTS
--  - post_reactions — one reaction per user per post (tap React to
--                     change it): sticker, meme, photo or short video
--  - post_comments  — body becomes optional so a comment can be a
--                     pure voice note (media_url + media_type='audio')
--
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

-- ------------------- 1. POST REACTIONS ------------------------------
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('sticker','meme','photo','video')),
  media_url text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;
drop policy if exists "post reactions: viewable" on public.post_reactions;
create policy "post reactions: viewable" on public.post_reactions
  for select to authenticated using (true);
drop policy if exists "post reactions: add own" on public.post_reactions;
create policy "post reactions: add own" on public.post_reactions
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "post reactions: change own" on public.post_reactions;
create policy "post reactions: change own" on public.post_reactions
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "post reactions: delete own" on public.post_reactions;
create policy "post reactions: delete own" on public.post_reactions
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------- 2. VOICE COMMENTS ------------------------------
alter table public.post_comments add column if not exists media_url text;
alter table public.post_comments add column if not exists media_type text;
alter table public.post_comments alter column body drop not null;
alter table public.post_comments drop constraint if exists post_comments_body_check;
alter table public.post_comments add constraint post_comments_shape check (
  (body is null or char_length(body) <= 500)
  and (media_type is null or media_type = 'audio')
  and (media_url is null or media_type = 'audio')
  and (body is not null or media_url is not null)
);

-- ------------------- 3. REALTIME -------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_reactions'
  ) then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
end
$$;

-- make PostgREST see the new columns right away
notify pgrst, 'reload schema';
