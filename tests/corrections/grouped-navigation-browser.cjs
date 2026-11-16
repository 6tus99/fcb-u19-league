const { chromium } = require('playwright');
const assert = require('assert/strict');
const fs = require('fs');

(async () => {
  const api = process.env.TEST_SUPABASE_URL || 'https://placeholder.supabase.co';
  const base = process.env.TEST_BASE_URL || 'http://localhost:8765';
  const key = `sb-${new URL(api).hostname.split('.')[0]}-auth-token`;
  const uid = '00000000-0000-0000-0000-000000000001';
  const friend = '00000000-0000-0000-0000-000000000002';
  const matchId = '01b20000-0000-4000-8000-000000000020';
  const articleId = 'c43492a8-606e-44f4-8bf9-c844c09e7001';
  const now = new Date().toISOString();
  const profiles = [{ id: uid, full_name: 'Test Fan', role: 'fan', points: 50 }, { id: friend, full_name: 'League Friend', role: 'fan' }];
  const teams = [{ id: 'home', name: 'Soche Madrid', short_name: 'SOC', primary_color: '#b91c1c' }, { id: 'away', name: 'Griffin Young Stars', short_name: 'GRI', primary_color: '#15803d' }];
  const matches = [{ id: matchId, home_team_id: 'home', away_team_id: 'away', home_score: 0, away_score: 0, status: 'scheduled', week: 3, scheduled_at: now, venue: 'Soche Ground, Blantyre' }];
  const messages = [1, 2].map(i => ({ id: 'message-' + i, sender_id: friend, recipient_id: uid, body: 'Hello from the league ' + i, created_at: now, read_at: null }));
  const articles = [{ id: articleId, title: 'League fixtures confirmed', body: 'Read the latest league announcements and fixtures.', created_at: now, author_id: uid, poll_options: [] }];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block', colorScheme: 'dark' });
  const output = __dirname + '/artifacts'; fs.mkdirSync(output, { recursive: true });
  const errors = [];
  await context.addInitScript(({ uid, key }) => localStorage.setItem(key, JSON.stringify({ access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test', refresh_token: 'fake', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400, user: { id: uid, email: 'test@example.com', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} } })), { uid, key });
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, socket => socket.onMessage(() => {}));
  await context.route(api + '/**', async route => {
    const req = route.request(), url = new URL(req.url()), table = url.pathname.split('/rest/v1/')[1];
    let rows = ({ profiles, teams, matches, news: articles, messages })[table] || [];
    if (url.pathname.includes('/rpc/get_points')) return route.fulfill({ contentType: 'application/json', body: '50' });
    rows = rows.filter(row => [...url.searchParams].every(([k, v]) => {
      if (v.startsWith('eq.')) return String(row[k]) === v.slice(3);
      if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(row[k]));
      if (v === 'is.null') return row[k] == null;
      if (v.startsWith('neq.')) return String(row[k]) !== v.slice(4);
      return true;
    }));
    if (req.method() === 'PATCH') rows.forEach(row => Object.assign(row, req.postDataJSON()));
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` }, body: req.method() === 'HEAD' ? '' : JSON.stringify(rows) });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const nav = () => page.getByRole('navigation', { name: 'Main navigation' });
  const checkFit = async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'page must fit phone width');
    assert.equal(await nav().evaluate(el => el.scrollWidth <= el.clientWidth), true, 'main navigation must fit without horizontal scrolling');
  };
  const assertStackedShortcut = async (name) => {
    const shortcut = page.getByRole('link', { name: 'Open ' + name, exact: true });
    const chip = page.getByRole('link', { name: 'Betting board', exact: true });
    const [s, b] = await Promise.all([shortcut.boundingBox(), chip.boundingBox()]);
    assert.ok(s && b && s.y + s.height + 8 <= b.y, name + ' must sit above, not overlap, betting');
    assert.ok(s.x >= 0 && s.x + s.width <= (await page.viewportSize()).width);
  };
  try {
    await page.goto(base + '/fan'); await page.getByText("Today's matches", { exact: true }).waitFor();
    await nav().getByRole('link', { name: 'News, 2 unread messages', exact: true }).waitFor();
    assert.deepEqual(await nav().getByRole('link').allTextContents(), ['Home', 'Standings', 'News2']);
    await checkFit(); await page.screenshot({ path: output + '/compact-home-navigation-phone.png', fullPage: false });
    console.log('PASS phone home: only Home / Standings / News, green unread-message badge, no horizontal navigation scroll');
    await nav().getByRole('link', { name: 'Standings', exact: true }).click();
    await page.getByRole('tab', { name: 'Table', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Table', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Matches', exact: true }).click(); await page.waitForURL('**/matches');
    await page.getByText('Soche Madrid', { exact: true }).first().waitFor();
    assert.equal(await nav().getByRole('link', { name: 'Standings', exact: true }).getAttribute('aria-current'), 'page');
    await page.getByRole('tab', { name: 'Teams', exact: true }).click(); await page.waitForURL('**/teams');
    await page.getByText('Griffin Young Stars', { exact: true }).waitFor();
    await checkFit(); await page.waitForTimeout(250); await page.screenshot({ path: output + '/standings-teams-sections-phone.png', fullPage: false });
    await page.getByRole('link', { name: /Soche Madrid/ }).click(); await page.waitForURL('**/teams/home');
    assert.equal(await page.getByRole('tab', { name: 'Teams', exact: true }).getAttribute('aria-selected'), 'true');
    await page.goto(base + '/matches/' + matchId);
    assert.equal(await page.getByRole('tab', { name: 'Matches', exact: true }).getAttribute('aria-selected'), 'true');
    console.log('PASS Standings: table, match list, teams and detail/deep links remain in the correct section');
    await nav().getByRole('link', { name: /^News/ }).click(); await page.waitForURL('**/news');
    await page.getByText('League fixtures confirmed', { exact: true }).waitFor();
    await assertStackedShortcut('Social'); await checkFit();
    await page.screenshot({ path: output + '/news-social-shortcut-phone.png', fullPage: false });
    await page.getByRole('link', { name: 'Open Social', exact: true }).click(); await page.waitForURL('**/social');
    await page.getByText('Be the first to post', { exact: true }).waitFor();
    await assertStackedShortcut('Messages'); await checkFit();
    assert.equal(await nav().getByRole('link', { name: /^News/ }).getAttribute('aria-current'), 'page');
    await page.screenshot({ path: output + '/social-messages-shortcut-phone.png', fullPage: false });
    await page.getByRole('link', { name: 'Open Messages', exact: true }).click(); await page.waitForURL('**/messages');
    await page.getByRole('button', { name: 'Chats', exact: true }).waitFor(); await checkFit();
    await page.getByRole('link', { name: 'Back to Social', exact: true }).click(); await page.waitForURL('**/social');
    await page.getByRole('link', { name: 'Back to News', exact: true }).click(); await page.waitForURL('**/news');
    console.log('PASS News -> Social -> Messages hierarchy, readable shortcuts stacked above the betting chip, and parent back links');
    await page.goto(base + '/news/' + articleId); await page.getByText('League fixtures confirmed', { exact: true }).waitFor();
    await assertStackedShortcut('Social');
    await page.goto(base + '/messages/' + friend); await page.getByPlaceholder('Type a message…').waitFor();
    assert.equal(await page.getByRole('link', { name: 'Betting board', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Open Messages', exact: true }).count(), 0);
    console.log('PASS news deep link keeps Social shortcut; open chats have no floating buttons over the send controls');
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 667 });
      for (const route of ['/fan', '/standings', '/matches', '/teams', '/news', '/social', '/messages']) {
        await page.goto(base + route); await nav().waitFor(); await page.waitForTimeout(100); await checkFit();
      }
    }
    console.log('PASS 320px and 375px: every grouped public section fits without horizontal page/nav overflow');
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base + '/news');
    await page.getByText('League fixtures confirmed', { exact: true }).waitFor(); await assertStackedShortcut('Social');
    await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click(); await checkFit();
    await page.screenshot({ path: output + '/grouped-navigation-desktop-light.png', fullPage: false });
    assert.deepEqual(errors, []); console.log('PASS desktop/light theme and no uncaught browser errors');
  } catch (error) {
    console.error((await page.locator('body').innerText()).slice(-6000));
    await page.screenshot({ path: output + '/grouped-navigation-failure.png', fullPage: true }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
