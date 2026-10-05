-- ============================================================
-- Role upgrades + phone verification codes (multi-auth)
-- Run this in the Supabase SQL Editor. Idempotent: safe to run
-- more than once.
-- ============================================================

-- 1) Phone number on profiles (international format, e.g. +265 99 123 4567)
alter table public.profiles add column if not exists phone text;

-- 2) Pending role changes. The 6-digit code is stored as a SHA-256 hash —
-- the raw code never sits in the database.
create table if not exists public.pending_role_changes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  new_role text not null check (new_role in ('admin','commissioner','manager','player','fan')),
  code_hash text not null,
  phone text,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','verified','cancelled')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index if not exists pending_role_changes_profile_idx on public.pending_role_changes (profile_id, status);

alter table public.pending_role_changes enable row level security;

-- A user can see their own pending upgrade; admins can see all of them.
drop policy if exists "users_select_own_pending_roles" on public.pending_role_changes;
create policy "users_select_own_pending_roles" on public.pending_role_changes
  for select using (
    profile_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Only admins can start a role upgrade (by creating a pending change).
drop policy if exists "admins_insert_role_changes" on public.pending_role_changes;
create policy "admins_insert_role_changes" on public.pending_role_changes
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Deliberately NO update/delete policies: only the Supabase edge functions
-- (which run with the service role) may verify codes and apply roles.

-- 3) New registrants: everyone joins as a FAN (role upgrades are granted by
-- an admin later), and their phone number is captured.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, team_id, phone)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
          'fan',
          null,
          new.raw_user_meta_data ->> 'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;
