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
