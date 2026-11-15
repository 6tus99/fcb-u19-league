const { chromium } = require('playwright');
const assert = require('assert/strict');
const fs = require('fs');

(async () => {
  const uid = '00000000-0000-0000-0000-000000000001';
  const a = '01b20000-0000-4000-8000-000000000020';
  const b = '01b20000-0000-4000-8000-000000000025';
  const api = process.env.TEST_SUPABASE_URL || 'https://placeholder.supabase.co';
  const storageKey = `sb-${new URL(api).hostname.split('.')[0]}-auth-token`;
  const base = process.env.TEST_BASE_URL || 'http://localhost:8765';
  const output = __dirname + '/artifacts'; fs.mkdirSync(output, { recursive: true });
  let notifications = [];
  const timestamp = Date.now();
  const notice = (id, title, matchId, age, body = '') => ({ id, user_id: uid, title, body, link: matchId ? `/matches/${matchId}` : '/social', read_at: null, created_at: new Date(timestamp - age * 60000).toISOString() });
  notifications.push(notice('goal', 'GOAL! Nyambadwe United v Ekhaya FC', a, 1, 'Nyambadwe United score in the 23rd minute.'));
  notifications.push(notice('card', 'Yellow card', a, 2, 'Ekhaya FC — dangerous tackle.'));
  notifications.push(notice('other', 'Match started', b, 3, 'CC Stars v Bullets Youth — Week 4.'));
  notifications.push(notice('friend', 'Friend request accepted', null, 4, 'Your friend request was accepted.'));
  notifications.push(notice('kickoff', 'Match started', a, 5, 'Nyambadwe United v Ekhaya FC — Week 3.'));
  for (let i = 0; i < 205; i++) notifications.push(notice(`older-${i}`, `Earlier update ${i + 1}`, a, 10 + i, 'Match event recorded.'));
  const teams = [{ id: 'home', name: 'Nyambadwe United', primary_color: '#17276a' }, { id: 'away', name: 'Ekhaya FC', primary_color: '#76a52e' }, { id: 'cc', name: 'CC Stars', primary_color: '#17276a' }, { id: 'bullets', name: 'Bullets Youth', primary_color: '#76a52e' }];
  const matches = [{ id: a, home_team_id: 'home', away_team_id: 'away', home_score: 3, away_score: 1, status: 'live', week: 3, scheduled_at: new Date().toISOString() }, { id: b, home_team_id: 'cc', away_team_id: 'bullets', home_score: 0, away_score: 0, status: 'live', week: 4, scheduled_at: new Date().toISOString() }];
  const patches = [], browserErrors = [], subscriptions = [];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
  await ctx.addInitScript(({ uid, key }) => {
    localStorage.setItem(key, JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test', refresh_token: 'fake', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, user: { id: uid, email: 'fan@test.example', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  }, { uid, key: storageKey });
  await ctx.routeWebSocket(/\/realtime\/v1\/websocket/, socket => {
    socket.onMessage(raw => {
      const wire = JSON.parse(raw.toString());
      const m = Array.isArray(wire) ? { join_ref: wire[0], ref: wire[1], topic: wire[2], event: wire[3], payload: wire[4] } : wire;
      const send = (event, payload, ref = null) => socket.send(JSON.stringify(Array.isArray(wire)
        ? [m.join_ref, ref, m.topic, event, payload]
        : { topic: m.topic, event, payload, ref, join_ref: m.join_ref }));
      if (m.event === 'phx_join') {
        const configs = (m.payload.config?.postgres_changes || []).map((c, i) => ({ ...c, id: subscriptions.length * 100 + i + 1 }));
        subscriptions.push({ socket, topic: m.topic, configs, send, active: true });
        send('phx_reply', { status: 'ok', response: { postgres_changes: configs } }, m.ref);
      } else if (m.event === 'phx_leave') {
        subscriptions.filter(s => s.topic === m.topic).forEach(s => { s.active = false; });
        send('phx_reply', { status: 'ok', response: {} }, m.ref);
      } else if (m.event === 'heartbeat') send('phx_reply', { status: 'ok', response: {} }, m.ref);
    });
  });
  await ctx.route(api + '/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1];
    let rows = [];
    if (table === 'notifications') rows = notifications;
    if (table === 'teams') rows = teams;
    if (table === 'matches') rows = matches;
    if (table === 'profiles') rows = [{ id: uid, full_name: 'Test Fan', role: 'fan' }];
    if (table === 'match_events') rows = [{ id: 'event', match_id: a, event_type: 'goal', minute: 23, team_id: 'home', description: 'Goal — Mphatso Jere' }];
    rows = rows.filter(row => [...url.searchParams].every(([k, v]) => {
      if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(row[k]));
      if (v === 'is.null') return row[k] == null;
      return true;
    }));
    if (req.method() === 'PATCH' && table === 'notifications') {
      const changes = req.postDataJSON(); patches.push(rows.map(r => r.id));
      rows.forEach(row => Object.assign(row, changes));
    }
    const count = rows.length;
    if (table === 'notifications') rows = [...rows].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at));
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    rows = rows.slice(offset, offset + limit);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `${offset}-${offset + Math.max(0, rows.length - 1)}/${count}`, 'access-control-allow-origin': '*' }, body: req.method() === 'HEAD' ? '' : JSON.stringify(rows) });
  });
  const page = await ctx.newPage(); page.on('pageerror', error => browserErrors.push(error.message));
  const wait = async condition => { for (let i = 0; i < 100; i++) { if (await condition()) return; await page.waitForTimeout(50); } throw Error('Condition not met: ' + condition); };
  const bell = () => page.getByRole('button', { name: 'Notifications', exact: true });
  const groupA = () => page.getByRole('button', { name: /^Nyambadwe United vs Ekhaya FC,/ });
  const groupB = () => page.getByRole('button', { name: /^CC Stars vs Bullets Youth,/ });
  try {
    await page.goto(base + '/matches'); await bell().click(); await groupA().waitFor(); await groupB().waitFor();
    assert.equal(await groupA().count(), 1); assert.equal(patches.length, 0);
    assert.equal(await page.getByText('GOAL! Nyambadwe United v Ekhaya FC', { exact: true }).count(), 1); // summary only, collapsed
    assert.equal(await page.getByText('Friend request accepted', { exact: true }).count(), 1);
    console.log('PASS phone: one group per match, unrelated notices separate, opening bell does not mark everything read');
    await groupA().click(); await page.getByRole('button', { name: 'Open live match', exact: true }).waitFor();
    await wait(() => notifications.filter(n => n.read_at).length === 10);
    assert.equal(notifications.find(n => n.id === 'other').read_at, null);
    assert.equal(notifications.find(n => n.id === 'friend').read_at, null);
    await page.getByText('Nyambadwe United v Ekhaya FC — Week 3.', { exact: true }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: output + '/match-notification-group-phone.png', fullPage: false });
    console.log('PASS phone: expanding shows kickoff/goal/card history and only marks visible match updates read');
    await page.getByRole('button', { name: 'Show earlier match updates', exact: true }).click();
    await wait(() => notifications.filter(n => n.read_at).length === 20);
    await page.getByRole('button', { name: 'Load older notifications', exact: true }).click();
    await wait(async () => (await groupA().getAttribute('aria-label')).includes('208 updates'));
    console.log('PASS older history: events beyond the first 200 load into the same group without duplication');
    const incoming = notice('incoming', 'Red card', a, -1, 'Ekhaya FC — player sent off.'); notifications.unshift(incoming); matches[0].home_score = 4;
    await wait(() => subscriptions.some(s => s.topic.includes('notifications-')));
    subscriptions.forEach(s => {
      const ids = s.configs.filter(c => c.table === 'notifications' && ['*', 'INSERT'].includes(c.event)).map(c => c.id);
      if (ids.length && s.active) s.send('postgres_changes', { ids, data: { schema: 'public', table: 'notifications', type: 'INSERT', columns: Object.keys(incoming).map(name => ({ name, type: 'text' })), record: incoming, old_record: {}, commit_timestamp: new Date().toISOString(), errors: null } });
    });
    await wait(async () => (await groupA().getAttribute('aria-label')).includes('209 updates'));
    assert.equal(await groupA().count(), 1);
    await page.getByText('Ekhaya FC — player sent off.', { exact: true }).first().waitFor();
    console.log('PASS realtime: a new event updates the existing expanded match group and score, with no duplicate group');
    // Dismiss the existing green toast before testing the menu's navigation.
    await page.locator('.MuiSnackbar-root').waitFor({ state: 'hidden', timeout: 12000 });
    if (await groupA().getAttribute('aria-expanded') !== 'true') await groupA().click();
    await page.getByRole('button', { name: 'Open live match', exact: true }).click();
    await page.waitForURL('**/matches/' + a);
    await page.getByText('Goal — Mphatso Jere', { exact: true }).waitFor();
    console.log('PASS match navigation: opens the live score and event timeline');
    await page.setViewportSize({ width: 1440, height: 1000 }); await bell().click(); await groupA().waitFor();
    await page.waitForTimeout(300); await page.screenshot({ path: output + '/match-notification-group-desktop.png', fullPage: false });
    assert.deepEqual(browserErrors, []);
    console.log('PASS desktop and no uncaught browser errors');
  } catch (error) {
    console.error((await page.locator('body').innerText()).slice(-8000));
    await page.screenshot({ path: output + '/notification-test-failure.png', fullPage: true }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
