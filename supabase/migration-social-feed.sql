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
