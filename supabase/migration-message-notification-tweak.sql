-- =====================================================================
--  MESSAGE NOTIFICATION TWEAK
--  The bell card no longer shows the message text — only
--  "New message from X" (tap opens the chat).
--  HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query
--  -> paste everything -> Run.  (Safe to re-run; idempotent.)
-- =====================================================================

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
    null,
    '/messages/' || new.sender_id);
  return new;
end;
$$;

notify pgrst, 'reload schema';
