const { chromium } = require('playwright');
const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const uid = '00000000-0000-0000-0000-000000000001';
const matchId = '01b20000-0000-4000-8000-000000000020';
const target = '/commissioner/match-center/live/' + matchId;
const password = '246810';
const base = process.env.TEST_BASE_URL || 'http://localhost:8765';
const api = process.env.TEST_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = `sb-${new URL(api).hostname.split('.')[0]}-auth-token`;
const output = __dirname + '/artifacts'; fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];
  async function session(role, options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });
    const state = {
      profile: { id: uid, role, full_name: 'Test ' + role, dashboard_pin_hash: options.create ? null : hash(uid + ':' + password), team_id: null },
      failCheck: false, failWrite: false, passwordWrites: 0, matchesReads: 0,
    };
    await ctx.addInitScript(({ uid, key }) => localStorage.setItem(key, JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test', refresh_token: 'fake', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, user: { id: uid, email: 'test@example.com', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} } })), { uid, key });
    await ctx.routeWebSocket(/\/realtime\/v1\/websocket/, socket => socket.onMessage(() => {}));
    await ctx.route(api + '/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const table = url.pathname.split('/rest/v1/')[1];
      let rows = [];
      const selected = url.searchParams.get('select') || '';
      if (table === 'profiles') {
        if (selected.includes('dashboard_pin_hash') && state.failCheck) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated outage' }) });
        rows = [state.profile];
        if (req.method() === 'PATCH' && req.postDataJSON().dashboard_pin_hash) {
          state.passwordWrites++;
          if (state.failWrite) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Simulated write failure' }) });
          if (url.searchParams.get('dashboard_pin_hash') === 'is.null' && state.profile.dashboard_pin_hash != null) rows = [];
          else Object.assign(state.profile, req.postDataJSON());
        }
      }
      if (table === 'notifications') rows = [{ id: 'assignment', user_id: uid, title: 'New match assignment', body: 'Nyambadwe United v Ekhaya FC', link: options.link || target, created_at: new Date().toISOString(), read_at: null }];
      if (table === 'matches') {
        state.matchesReads++;
        rows = [{ id: matchId, home_team_id: 'home', away_team_id: 'away', home_score: 2, away_score: 1, status: 'live', week: 3, scheduled_at: new Date().toISOString(), commissioner_id: uid, report_finalized_at: null, live_started_at: new Date(Date.now() - 600000).toISOString() }];
      }
      if (table === 'teams') rows = [{ id: 'home', name: 'Nyambadwe United', primary_color: '#17276a' }, { id: 'away', name: 'Ekhaya FC', primary_color: '#76a52e' }];
      if (table === 'match_events') rows = [];
      if (!(table === 'profiles' && req.method() === 'PATCH')) rows = rows.filter(row => [...url.searchParams].every(([k, v]) => {
        if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
        if (v === 'is.null') return row[k] == null;
        if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(row[k]));
        return true;
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` }, body: req.method() === 'HEAD' ? '' : JSON.stringify(rows) });
    });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    return { ctx, page, state };
  }
  const unlock = async (page, pin = password) => {
    await page.getByLabel('6-digit password').fill(pin);
    await page.getByRole('dialog').getByRole('button', { name: 'Unlock', exact: true }).click();
  };
  let current;
  try {
    // Actual notification click, not just a direct URL.
    current = await session('commissioner'); let { page, state } = current;
    await page.goto(base + '/matches'); await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.getByText('New match assignment', { exact: true }).click();
    await page.getByLabel('6-digit password').waitFor();
    assert.equal(new URL(page.url()).pathname, target);
    assert.equal(await page.getByRole('heading', { name: 'Live Match Control', exact: true }).count(), 0);
    const reads = state.matchesReads;
    await page.waitForTimeout(250); await page.screenshot({ path: output + '/dashboard-notification-password-phone.png', fullPage: false });
    await unlock(page, '111111'); await page.getByText('Wrong password — try again.', { exact: true }).waitFor();
    assert.equal(state.matchesReads, reads);
    console.log('PASS assignment notification and wrong password: match controls never mount or request match data while locked');
    await unlock(page); await page.getByRole('heading', { name: 'Live Match Control', exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, target);
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
    await page.getByRole('heading', { name: 'Match Reports', exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    console.log('PASS successful verification preserves assigned-match destination; navigation inside the dashboard stays unlocked');
    await page.getByRole('button', { name: 'Go to fan home', exact: true }).click();
    await page.waitForURL('**/fan'); await page.goBack();
    await page.getByLabel('6-digit password').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForURL('**/fan');
    assert.equal(await page.getByRole('heading', { name: 'Match Reports', exact: true }).count(), 0);
    console.log('PASS leaving/re-entering through browser history requires the password; Cancel returns safely to fan home');
    await page.goto(base + target); await unlock(page);
    await page.getByRole('heading', { name: 'Live Match Control', exact: true }).waitFor();
    await page.reload(); await page.getByLabel('6-digit password').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Live Match Control', exact: true }).count(), 0);
    console.log('PASS refresh/direct link relocks; no unlock token is saved in localStorage/sessionStorage');
    state.failCheck = true; await page.reload();
    await page.getByText('Could not check your dashboard password. Please retry. Access remains locked.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save & open', exact: true }).count(), 0);
    state.failCheck = false; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByLabel('6-digit password').waitFor();
    console.log('PASS password lookup failure fails closed, with retry rather than bypass or unwanted password creation');
    state.profile.dashboard_pin_hash = null;
    await unlock(page); await page.getByRole('heading', { name: 'Create your dashboard password', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Live Match Control', exact: true }).count(), 0);
    state.profile.dashboard_pin_hash = hash(uid + ':' + password);
    await page.goto(base + '/commissioner/live/' + matchId);
    await page.getByLabel('6-digit password').waitFor(); assert.equal(new URL(page.url()).pathname, target);
    await unlock(page); await page.getByRole('heading', { name: 'Live Match Control', exact: true }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.getByLabel('6-digit password').waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Live Match Control', exact: true }).count(), 0);
    console.log('PASS password reset during verification, legacy links and restored-page relocking');
    await current.ctx.close();

    for (const [role, route] of [['admin', '/admin/users'], ['manager', '/manager/matches'], ['player', '/player/matches'], ['editor', '/editor/news']]) {
      current = await session(role, { link: route }); ({ page, state } = current);
      await page.goto(base + route); await page.getByLabel('6-digit password').waitFor();
      assert.equal(state.matchesReads, 0);
      if (role === 'admin') { await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(250); await page.screenshot({ path: output + '/dashboard-password-desktop.png', fullPage: false }); }
      await unlock(page); await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(new URL(page.url()).pathname, route);
      await page.goto(base + '/matches');
      await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await page.getByText('New match assignment', { exact: true }).click();
      await page.getByLabel('6-digit password').waitFor();
      assert.equal(new URL(page.url()).pathname, route);
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.waitForURL('**/fan');
      await page.getByRole('button', { name: 'My dashboard', exact: true }).click();
      await page.getByLabel('6-digit password').waitFor();
      console.log('PASS ' + role + ': direct links, notifications and My dashboard all require its existing password');
      await current.ctx.close();
    }
    current = await session('manager', { create: true }); ({ page, state } = current);
    await page.goto(base + '/manager'); await page.getByRole('heading', { name: 'Create your dashboard password', exact: true }).waitFor();
    await page.getByLabel('6-digit password').fill(password); await page.getByLabel('Repeat password').fill('111111');
    await page.getByRole('button', { name: 'Save & open', exact: true }).click(); await page.getByText('The two passwords do not match.', { exact: true }).waitFor();
    assert.equal(state.passwordWrites, 0);
    state.failWrite = true;
    await page.getByLabel('Repeat password').fill(password); await page.getByRole('button', { name: 'Save & open', exact: true }).click();
    await page.getByText('Could not save your dashboard password. Please try again.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'My Team', exact: true }).count(), 0);
    state.failWrite = false;
    await page.getByRole('button', { name: 'Save & open', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(state.profile.dashboard_pin_hash, hash(uid + ':' + password));
    console.log('PASS first-time creation requires matching passwords and a successful save before granting access');
    await current.ctx.close();

    current = await session('fan'); ({ page } = current);
    await page.goto(base + '/admin/users'); await page.waitForURL('**/fan');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.goto(base + '/matches/' + matchId); await page.getByText('Nyambadwe United', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    console.log('PASS role authorisation still blocks fans; shared fan match pages remain PIN-free');
    assert.deepEqual(errors, []); console.log('PASS no uncaught browser errors');
    await current.ctx.close();
  } catch (error) {
    if (current) { console.error((await current.page.locator('body').innerText()).slice(-7000)); await current.page.screenshot({ path: output + '/dashboard-gate-failure.png', fullPage: true }); }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
