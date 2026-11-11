-- =====================================================================
--  FRIEND REQUEST NOTIFICATIONS (bell)
--  - The invitee gets a bell notification when a request arrives.
--  - The sender gets a confirmation when the invitee accepts.
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

create or replace function public.handle_friend_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
begin
  -- a new request arrives: notify the person it is addressed to
  if (TG_OP = 'INSERT' and new.status = 'pending') then
    select full_name into v_name from public.profiles where id = new.user_id;
    perform public.notify_users(array[new.added_id],
      'New friend request',
      coalesce(v_name, 'Someone') || ' wants to be your friend. Open Messages, then Friends, to accept or decline.',
      '/messages');
    return new;
  end if;
  -- the invitee accepted: confirm to the person who sent it
  if (TG_OP = 'UPDATE' and new.status = 'accepted' and old.status = 'pending') then
    select full_name into v_name from public.profiles where id = new.added_id;
    perform public.notify_users(array[new.user_id],
      'Friend request accepted',
      coalesce(v_name, 'Someone') || ' accepted your friend request — you are now friends.',
      '/messages');
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists on_friend_request on public.supporters;
create trigger on_friend_request
  after insert or update on public.supporters
  for each row execute function public.handle_friend_request();

notify pgrst, 'reload schema';
