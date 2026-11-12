-- =====================================================================
--  ROLE CODE VERIFICATION (activates role changes)
--  - Makes the 6-digit role code work: the member enters it in the
--    app and the role is applied.
--  - Removes the user-deletion function (admins change roles, they
--    do not delete members).
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

drop function if exists public.delete_user_account(uuid);

create or replace function public.verify_role_code(code_hash text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_row record;
begin
  select id, new_role, code_hash, expires_at
  into v_row
  from public.pending_role_changes
  where profile_id = auth.uid()
    and status = 'pending'
  order by created_at desc
  limit 1;

  if v_row is null then
    raise exception 'no pending role change for you';
  end if;

  if v_row.expires_at < now() then
    update public.pending_role_changes set status = 'cancelled' where id = v_row.id;
    raise exception 'code expired - ask the admin to send a new one';
  end if;

  if v_row.code_hash is distinct from code_hash then
    raise exception 'wrong code';
  end if;

  update public.profiles set role = v_row.new_role where id = v_row.profile_id;
  update public.pending_role_changes
    set status = 'verified', verified_at = now()
  where id = v_row.id;

  return v_row.new_role;
end;
$$;

revoke execute on function public.verify_role_code(text) from public;
revoke execute on function public.verify_role_code(text) from anon;
grant execute on function public.verify_role_code(text) to authenticated;

notify pgrst, 'reload schema';
