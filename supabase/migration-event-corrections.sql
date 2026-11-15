-- Run ONCE in Supabase SQL Editor (safe to run again).
-- Atomic event recording/corrections, soft cancellation, audit and report locking.
begin;
alter table public.matches add column if not exists report_finalized_at timestamptz;
alter table public.matches add column if not exists report_finalized_by uuid references public.profiles(id);
alter table public.match_events add column if not exists cancelled_at timestamptz;
alter table public.match_events add column if not exists cancelled_by uuid references public.profiles(id);
alter table public.match_events add column if not exists cancellation_reason text;
alter table public.match_events add column if not exists revision int not null default 1;
alter table public.match_events drop constraint if exists match_events_event_type_check;
alter table public.match_events add constraint match_events_event_type_check check(event_type in
 ('goal','foul','yellow_card','red_card','substitution','note','half_time','second_half','extra_time'));

create table if not exists public.match_correction_history (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.matches(id) on delete cascade,
 event_id uuid references public.match_events(id) on delete set null,
 actor_id uuid references public.profiles(id) on delete set null,
 actor_name text not null,
 action text not null,
 reason text not null,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);
alter table public.match_correction_history enable row level security;
drop policy if exists "assigned officials read correction history" on public.match_correction_history;
create policy "assigned officials read correction history" on public.match_correction_history
 for select to authenticated using (
 public.has_role('{admin}') or exists(select 1 from public.matches m where m.id=match_id and m.commissioner_id=auth.uid())
 );
grant select on public.match_correction_history to authenticated;
-- No client can modify audit history, hard-delete events or bypass the RPC checks.
drop policy if exists "admins and commissioners manage match events" on public.match_events;

create or replace function public.save_match_event(
 p_match_id uuid, p_event_id uuid default null, p_action text default 'record',
 p_event_type text default null, p_team_id uuid default null, p_player_id uuid default null,
 p_minute int default null, p_description text default null, p_reason text default null,
 p_revision int default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
 m public.matches; old_ev public.match_events; new_ev public.match_events;
 who public.profiles; dh int := 0; da int := 0;
begin
 select * into who from public.profiles where id=auth.uid();
 -- Lock the match FIRST: concurrent goals/cancellations/finalisation are serialised.
 select * into m from public.matches where id=p_match_id for update;
 if m.id is null or who.id is null or (who.role <> 'admin' and
   (who.role <> 'commissioner' or m.commissioner_id is distinct from who.id)) then
   raise exception 'Only the assigned commissioner or an admin may change this match.';
 end if;
 if m.report_finalized_at is not null then raise exception 'Report is finalised. Ask an admin to reopen it.'; end if;
 if m.status not in ('live','finished') then raise exception 'Start the match before recording events.'; end if;
 if p_action not in ('record','edit','cancel') then raise exception 'Invalid event action.'; end if;
 if p_action <> 'record' then
   if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Give a reason for this correction.'; end if;
   select * into old_ev from public.match_events where id=p_event_id and match_id=m.id for update;
   if old_ev.id is null then raise exception 'Event not found.'; end if;
   if p_revision is distinct from old_ev.revision then raise exception 'This event changed on another device. Reload it and try again.'; end if;
   if old_ev.cancelled_at is not null then raise exception 'This event has already been cancelled.'; end if;
   if old_ev.event_type='goal' then
     dh := case when old_ev.team_id=m.home_team_id then -1 else 0 end;
     da := case when old_ev.team_id=m.away_team_id then -1 else 0 end;
   end if;
 end if;
 if p_action <> 'cancel' then
   if p_event_type is null or p_event_type not in ('goal','foul','yellow_card','red_card','substitution','note','half_time','second_half','extra_time') then
     raise exception 'Choose a valid event type.';
   end if;
   if p_minute is not null and (p_minute < 0 or p_minute > 300) then raise exception 'Minute must be between 0 and 300.'; end if;
   if p_event_type in ('goal','foul','yellow_card','red_card','substitution') and p_team_id is null then raise exception 'Select the team.'; end if;
   if p_team_id is not null and p_team_id not in (m.home_team_id,m.away_team_id) then raise exception 'Team is not in this match.'; end if;
   if p_player_id is not null and not exists(select 1 from public.profiles where id=p_player_id and role='player' and team_id=p_team_id) then
     raise exception 'Select a player belonging to this team.';
   end if;
   if p_event_type in ('half_time','second_half') and exists(select 1 from public.match_events where match_id=m.id and event_type=p_event_type and cancelled_at is null and id is distinct from p_event_id) then
     raise exception 'That match phase is already recorded.';
   end if;
   if p_event_type='goal' then
     dh := dh + case when p_team_id=m.home_team_id then 1 else 0 end;
     da := da + case when p_team_id=m.away_team_id then 1 else 0 end;
   end if;
 end if;
 if m.home_score+dh < 0 or m.away_score+da < 0 then raise exception 'Score is inconsistent. Ask an admin to review this match.'; end if;
 -- Score + event + audit + notification all commit or roll back together.
 -- Deltas preserve older manually entered results; do not reset historical scores.
 update public.matches set home_score=home_score+dh, away_score=away_score+da where id=m.id;
 if p_action='record' then
   insert into public.match_events(match_id,event_type,team_id,player_id,minute,description)
   values(m.id,p_event_type,p_team_id,p_player_id,p_minute,nullif(trim(p_description),'')) returning * into new_ev;
 elsif p_action='edit' then
   update public.match_events set event_type=p_event_type,team_id=p_team_id,player_id=p_player_id,
     minute=p_minute,description=nullif(trim(p_description),''),revision=revision+1
     where id=old_ev.id returning * into new_ev;
 else
   update public.match_events set cancelled_at=now(),cancelled_by=who.id,
     cancellation_reason=trim(p_reason),revision=revision+1 where id=old_ev.id returning * into new_ev;
 end if;
 insert into public.match_correction_history(match_id,event_id,actor_id,actor_name,action,reason,before_data,after_data)
 values(m.id,new_ev.id,who.id,coalesce(who.full_name,'Match official'),p_action,
   case when p_action='record' then 'Event recorded' else trim(p_reason) end,
   case when p_action='record' then null else to_jsonb(old_ev) end,to_jsonb(new_ev));
 if p_action <> 'record' and to_regprocedure('public.notify_users(uuid[],text,text,text)') is not null
   and to_regprocedure('public.all_user_ids()') is not null then
   perform public.notify_users(public.all_user_ids(),
     case when p_action='cancel' then 'Event cancelled' else 'Match event corrected' end,
     (select name from public.teams where id=m.home_team_id) || ' v ' ||
     (select name from public.teams where id=m.away_team_id) || ': ' ||
     coalesce(old_ev.description,replace(old_ev.event_type,'_',' ')) ||
     case when p_action='edit' then ' → ' || coalesce(new_ev.description,replace(new_ev.event_type,'_',' ')) else '' end ||
     ' — ' || trim(p_reason) ||
     '. Score: ' || (m.home_score+dh) || '-' || (m.away_score+da), '/matches/' || m.id);
 end if;
 return new_ev.id;
end $$;
revoke all on function public.save_match_event(uuid,uuid,text,text,uuid,uuid,int,text,text,int) from public,anon;
grant execute on function public.save_match_event(uuid,uuid,text,text,uuid,uuid,int,text,text,int) to authenticated;

create or replace function public.manage_match_report(p_match_id uuid,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare m public.matches; who public.profiles;
begin
 select * into who from public.profiles where id=auth.uid();
 select * into m from public.matches where id=p_match_id for update;
 if m.id is null or who.id is null or (who.role <> 'admin' and
   (who.role <> 'commissioner' or m.commissioner_id is distinct from who.id)) then raise exception 'Not authorised for this match.'; end if;
 if m.status <> 'finished' then raise exception 'End the match before finalising its report.'; end if;
 if p_action='finalise' then
   if m.report_finalized_at is not null then raise exception 'Report is already finalised.'; end if;
   update public.matches set report_finalized_at=now(),report_finalized_by=who.id where id=m.id;
 elsif p_action='reopen' then
   if who.role <> 'admin' then raise exception 'Only an admin may reopen a finalised report.'; end if;
   if m.report_finalized_at is null then raise exception 'Report is already open.'; end if;
   if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Give a reason for reopening.'; end if;
   update public.matches set report_finalized_at=null,report_finalized_by=null where id=m.id;
 else raise exception 'Invalid report action.';
 end if;
 insert into public.match_correction_history(match_id,actor_id,actor_name,action,reason,before_data,after_data)
 values(m.id,who.id,coalesce(who.full_name,'Match official'),p_action,
   case when p_action='finalise' then 'Report checked and submitted' else trim(p_reason) end,
   jsonb_build_object('report_finalized_at',m.report_finalized_at),
   jsonb_build_object('report_finalized_at',case when p_action='finalise' then now() else null end));
end $$;
revoke all on function public.manage_match_report(uuid,text,text) from public,anon;
grant execute on function public.manage_match_report(uuid,text,text) to authenticated;

-- Guard direct REST updates too, not just buttons in the app.
create or replace function public.guard_match_report() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then
   if old.report_finalized_at is not null then raise exception 'Reopen the report before deleting this match.'; end if;
   return old;
 end if;
 if old.report_finalized_at is not null and
   (new.home_score,new.away_score,new.status,new.home_team_id,new.away_team_id)
   is distinct from (old.home_score,old.away_score,old.status,old.home_team_id,old.away_team_id) then
   raise exception 'Finalised match: reopen the report before changing its result.';
 end if;
 if current_user in ('authenticated','anon') then
   if (new.report_finalized_at,new.report_finalized_by) is distinct from (old.report_finalized_at,old.report_finalized_by) then
     raise exception 'Use the report action to finalise or reopen.';
   end if;
   if not public.has_role('{admin}') then
     if old.commissioner_id is distinct from auth.uid() or not public.has_role('{commissioner}') then raise exception 'You are not assigned to this match.'; end if;
     if (new.home_score,new.away_score,new.home_team_id,new.away_team_id,new.commissioner_id,new.referee_id,new.week,new.scheduled_at,new.venue)
       is distinct from (old.home_score,old.away_score,old.home_team_id,old.away_team_id,old.commissioner_id,old.referee_id,old.week,old.scheduled_at,old.venue) then
       raise exception 'Use match events to update the score; fixture details are admin-only.';
     end if;
     if new.status is distinct from old.status and not ((old.status='scheduled' and new.status='live') or (old.status='live' and new.status='finished')) then
       raise exception 'Invalid match status transition.';
     end if;
   end if;
 end if;
 return new;
end $$;
drop trigger if exists guard_match_report on public.matches;
create trigger guard_match_report before update or delete on public.matches for each row execute function public.guard_match_report();
-- Replace broad commissioner ALL access: no creating/deleting someone else's fixtures.
drop policy if exists "admins and commissioners manage matches" on public.matches;
drop policy if exists "admins manage fixtures" on public.matches;
create policy "admins manage fixtures" on public.matches for all to authenticated
 using(public.has_role('{admin}')) with check(public.has_role('{admin}'));
drop policy if exists "assigned commissioners update matches" on public.matches;
create policy "assigned commissioners update matches" on public.matches for update to authenticated
 using(public.has_role('{commissioner}') and commissioner_id=auth.uid())
 with check(public.has_role('{commissioner}') and commissioner_id=auth.uid());
notify pgrst, 'reload schema';
commit;
