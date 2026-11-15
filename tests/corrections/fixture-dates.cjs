const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
(async () => {
  const db = new PGlite();
  await db.exec(`
    create table teams(id uuid primary key, name text);
    create table matches(id uuid primary key, week int default 3, status text,
      scheduled_at timestamptz, home_team_id uuid, away_team_id uuid,
      home_score int default 2, away_score int default 1,
      live_started_at timestamptz default '2026-11-14 10:01+02',
      commissioner_id text default 'unchanged', report_finalized_at timestamptz);
    insert into matches(id,status,scheduled_at) values
      ('01b20000-0000-4000-8000-000000000018','live','2026-11-14 10:00+02'),
      ('01b20000-0000-4000-8000-000000000020','scheduled','2026-11-14 16:00+02'),
      ('01b20000-0000-4000-8000-000000000025','scheduled','2026-11-21 10:00+02'),
      ('01b20000-0000-4000-8000-000000000017','finished','2026-11-13 10:00+02'),
      ('af91a3e3-729c-4a74-aa9d-41ff02575186','scheduled','2026-10-14 22:00+02'),
      ('01b20000-0000-4000-8000-000000000032','scheduled',null);
  `);
  const snapshot = async () => (await db.query('select * from matches order by id')).rows;
  const before = await snapshot();
  const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migration-refresh-fixture-dates.sql'), 'utf8');
  await db.exec(migration);
  const after = await snapshot();
  assert.equal(after.length, before.length);
  for (const old of before) {
    const row = after.find(r => r.id === old.id);
    const { scheduled_at: oldDate, ...oldRest } = old;
    const { scheduled_at: newDate, ...newRest } = row;
    assert.deepEqual(newRest, oldRest);
    if (old.status === 'finished' || oldDate == null) assert.deepEqual(newDate, oldDate);
  }
  console.log('PASS finished/undated fixtures untouched; no changes to scores, status, assignments or live clock');
  const { rows } = await db.query(`select id,
    (scheduled_at at time zone 'Africa/Blantyre')::date = (now() at time zone 'Africa/Blantyre')::date as is_today,
    (scheduled_at at time zone 'Africa/Blantyre')::date >= (now() at time zone 'Africa/Blantyre')::date as not_past,
    to_char(scheduled_at at time zone 'Africa/Blantyre','HH24:MI') as kickoff
    from matches where status in ('live','scheduled') and scheduled_at is not null`);
  assert.ok(rows.every(r => r.not_past));
  assert.equal(rows.find(r => r.id.endsWith('18')).is_today, true);
  assert.equal(rows.find(r => r.id.startsWith('af91')).is_today, true);
  assert.equal(rows.find(r => r.id.startsWith('af91')).kickoff, '22:00');
  assert.equal(rows.find(r => r.id.endsWith('20')).kickoff, '16:00');
  assert.equal((await db.query(`select (a.scheduled_at at time zone 'Africa/Blantyre')::date - (b.scheduled_at at time zone 'Africa/Blantyre')::date as gap from matches a, matches b where a.id::text like '%000025' and b.id::text like '%000020'`)).rows[0].gap, 7);
  console.log('PASS live match and older extra fixture moved to today; scheduled fixtures today onward; kickoff times and weekly gap preserved');
  await db.exec(migration);
  assert.deepEqual(await snapshot(), after);
  console.log('PASS repeat run is idempotent on the same day');
  await db.exec("delete from matches; insert into matches(id,status,scheduled_at) values ('af91a3e3-729c-4a74-aa9d-41ff02575186','scheduled','2026-01-01 22:00+02');");
  await db.exec(migration);
  assert.equal((await db.query("select (scheduled_at at time zone 'Africa/Blantyre')::date=(now() at time zone 'Africa/Blantyre')::date ok from matches")).rows[0].ok, true);
  console.log('PASS fallback when no seeded fixtures remain');
  await db.exec("delete from matches"); await db.exec(migration);
  console.log('PASS empty fixture list');
  await db.close();
})().catch(e => { console.error(e); process.exit(1); });
