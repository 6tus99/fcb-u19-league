const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const assert = require('assert/strict');
module.exports = async()=>{
 const db = new PGlite();
 await db.exec(`
 create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create table profiles(id uuid primary key,full_name text,role text not null,team_id uuid,dashboard_pin_hash text);
 create table teams(id uuid primary key,name text);
 create table matches(id uuid primary key,home_team_id uuid,away_team_id uuid,commissioner_id uuid,referee_id uuid,week int,scheduled_at timestamptz,venue text,status text,home_score int default 0,away_score int default 0,live_started_at timestamptz);
 create table match_events(id uuid primary key default gen_random_uuid(),match_id uuid references matches(id) on delete cascade,event_type text,team_id uuid,player_id uuid,minute int,description text,created_at timestamptz default now());
 create function public.has_role(roles text[]) returns boolean language sql security definer stable as $$select exists(select 1 from profiles where id=auth.uid() and role=any(roles))$$;
 alter table matches enable row level security; alter table match_events enable row level security;
 create policy "matches are viewable" on matches for select to authenticated using(true);
 create policy "match events are viewable" on match_events for select to authenticated using(true);
 create policy "admins and commissioners manage matches" on matches for all to authenticated using(has_role('{admin,commissioner}')) with check(has_role('{admin,commissioner}'));
 create policy "admins and commissioners manage match events" on match_events for all to authenticated using(has_role('{admin,commissioner}')) with check(has_role('{admin,commissioner}'));
 grant usage on schema public to authenticated,anon; grant all on all tables in schema public to authenticated;
 `);
 await db.exec(`create table notifications(id uuid default gen_random_uuid(),title text,body text,link text);
 create function public.notify_users(uids uuid[],title text,body text,link text) returns void language plpgsql security definer set search_path=public as $$begin insert into notifications(title,body,link) values(title,body,link); end$$;
 grant select on notifications to authenticated;`);
 await db.exec(fs.readFileSync(require('path').join(__dirname,'../../supabase/migration-match-notifications.sql'),'utf8'));
 const sql=fs.readFileSync(require('path').join(__dirname, '../../supabase/migration-event-corrections.sql'),'utf8');
 await db.exec(sql); await db.exec(sql); console.log('PASS migration applies twice');
 const ids=Array.from({length:9},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
 const [comm,admin,fan,other,home,away,p1,p2,mid]=ids;
 await db.query(`insert into profiles(id,full_name,role,team_id) values ($1,'Commissioner','commissioner',null),($2,'Admin','admin',null),($3,'Fan','fan',null),($4,'Other commissioner','commissioner',null),($5,'John','player',$7),($6,'Peter','player',$7)`,[comm,admin,fan,other,p1,p2,home]);
 await db.query(`insert into teams values($1,'Yizo Yizo Warriors'),($2,'Brothers in Arms FC')`,[home,away]);
 await db.query(`insert into matches(id,home_team_id,away_team_id,commissioner_id,status,week,scheduled_at) values($1,$2,$3,$4,'live',1,now())`,[mid,home,away,comm]);
 async function as(id){await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id]); await db.exec('set role authenticated');}
 async function fail(fn,pat){try{await fn();throw new Error('DID NOT REJECT')}catch(e){assert.match(e.message,pat);}}
 async function score(h,a){const m=(await db.query('select * from matches where id=$1',[mid])).rows[0];assert.equal(m.home_score,h);assert.equal(m.away_score,a);}
 const save=async(a={})=>(await db.query(`select save_match_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) id`,[mid,a.id||null,a.action||'record',a.type||'goal',a.team===undefined?home:a.team,a.player||null,a.minute??23,a.description||'Goal — John',a.reason||null,a.rev||null])).rows[0].id;
 return { db, ids, as, fail, score, save };
};
