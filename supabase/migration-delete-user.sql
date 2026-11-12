-- =====================================================================
--  DELETE USER (admin only)
--  Activates the Delete button in Manage Users. Removing the login
--  also removes their profile, messages, friend links, posts and
--  notifications automatically.
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

create or replace function public.delete_user_account(target_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if target_id is null then
    raise exception 'no user id supplied';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'unauthorized: only the league admin can delete accounts';
  end if;
  if target_id = auth.uid() then
    raise exception 'you cannot delete your own account';
  end if;
  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception 'user not found';
  end if;
  -- best effort: remove this member's avatar files
  begin
    delete from storage.objects
    where bucket_id = 'social-media'
      and name like target_id || '/%';
  exception when others then
    null;
  end;
  -- the login goes first; profiles + all member data cascade from it
  delete from auth.users where id = target_id;
end;
$$;

revoke execute on function public.delete_user_account(uuid) from public;
revoke execute on function public.delete_user_account(uuid) from anon;
grant execute on function public.delete_user_account(uuid) to authenticated;

notify pgrst, 'reload schema';
