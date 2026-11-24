const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const api = 'https://placeholder.supabase.co';
  const base = process.env.TEST_BASE_URL || 'http://localhost:8765';
  const uid = '00000000-0000-0000-0000-000000000001';
  const authorId = '00000000-0000-0000-0000-000000000002';
  const likedPostId = '00000000-0000-4000-8000-000000000001';
  const otherPostId = '00000000-0000-4000-8000-000000000002';
  const now = new Date().toISOString();
  const profiles = [
    { id: uid, full_name: 'Test Fan', role: 'fan', points: 500, display_name: null, avatar_url: null },
    { id: authorId, full_name: 'League Friend', role: 'fan', points: 100, display_name: null, avatar_url: null },
  ];
  const posts = [
    { id: likedPostId, user_id: authorId, body: 'Populated liked post with two-digit counts', created_at: now, profiles: { full_name: 'League Friend', role: 'fan' } },
    { id: otherPostId, user_id: authorId, body: 'Populated post without counts', created_at: now, profiles: { full_name: 'League Friend', role: 'fan' } },
  ];
  const likes = Array.from({ length: 12 }, (_, i) => ({
    id: 'like-' + i, post_id: likedPostId, user_id: i === 0 ? uid : `fan-${i}`,
  }));
  const comments = Array.from({ length: 11 }, (_, i) => ({
    id: 'comment-' + i, post_id: likedPostId, user_id: authorId,
    body: i === 0 ? 'Fictional comment fixture' : `Fictional comment ${i}`,
    created_at: now, media_url: null, media_type: null, profiles: { full_name: 'League Friend' },
  }));
  const reactionImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23d1fae5'/%3E%3Ccircle cx='32' cy='32' r='18' fill='%2384cc16'/%3E%3C/svg%3E";
  const reactions = Array.from({ length: 10 }, (_, i) => ({
    id: 'reaction-' + i, post_id: likedPostId, user_id: `fan-${i}`,
    kind: 'sticker', media_url: reactionImage, created_at: now, profiles: { full_name: 'League Friend' },
  }));
  const rowsByTable = { profiles, posts, post_likes: likes, post_comments: comments, post_reactions: reactions };
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(({ uid }) => {
    localStorage.setItem('fcb-install-dismissed', '1');
    localStorage.setItem('sb-placeholder-auth-token', JSON.stringify({
      access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test',
      refresh_token: 'fake',
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      expires_in: 86400,
      user: { id: uid, email: 'test@example.com', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} },
    }));
  }, { uid });
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, socket => socket.onMessage(() => {}));
  await context.route(api + '/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/rest/v1/')[1];
    if (url.pathname.includes('/rpc/get_points')) {
      return route.fulfill({ contentType: 'application/json', body: '500' });
    }

    let rows = rowsByTable[table] || [];
    rows = rows.filter(row => [...url.searchParams].every(([key, value]) => {
      if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
      if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
      if (value === 'is.null') return row[key] == null;
      return true;
    }));

    if (request.method() === 'DELETE' && table === 'post_likes') {
      const remove = new Set(rows);
      rowsByTable[table] = rowsByTable[table].filter(row => !remove.has(row));
    } else if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      rows.forEach(row => Object.assign(row, body));
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-expose-headers': 'content-range',
        'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(rows),
    });
  });

  const page = await context.newPage();
  try {
    await page.goto(base + '/social');
    await page.getByText('Populated liked post with two-digit counts', { exact: true }).waitFor();
    const likedCard = page.locator(`[data-post-card="${likedPostId}"]`);
    const emptyCard = page.locator(`[data-post-card="${otherPostId}"]`);
    const actionNames = ['Like, 12', 'React, 10', 'Comment, 11', 'Gift'];

    for (const width of [320, 375, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(120);
      for (const card of [likedCard, emptyCard]) {
        const cardBox = await card.boundingBox();
        const actions = card.locator('[data-post-actions]');
        assert.ok(cardBox, 'post card should be visible');
        assert.equal(await actions.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2);
        assert.equal(await actions.getByRole('button').count(), 4);
        const actionBox = await actions.boundingBox();
        assert.ok(actionBox.x >= cardBox.x && actionBox.x + actionBox.width <= cardBox.x + cardBox.width, `actions stay inside card at ${width}px`);

        for (const button of await actions.getByRole('button').all()) {
          const buttonBox = await button.boundingBox();
          assert.ok(buttonBox.height >= 44, `tap target is at least 44px high at ${width}px`);
          assert.ok(buttonBox.x >= cardBox.x && buttonBox.x + buttonBox.width <= cardBox.x + cardBox.width, `button stays inside card at ${width}px`);
          assert.ok(await button.evaluate(el => el.scrollWidth <= el.clientWidth), `button content does not overflow at ${width}px`);
          const icon = button.locator('.MuiButton-startIcon');
          const label = button.locator('[data-action-label]');
          const count = button.locator('[data-action-count]');
          const iconBox = await icon.boundingBox();
          const labelBox = await label.boundingBox();
          assert.ok(iconBox && labelBox && iconBox.x + iconBox.width <= labelBox.x, `icon and label remain separate at ${width}px`);
          if (await count.count()) {
            const countBox = await count.boundingBox();
            assert.ok(countBox && labelBox.x + labelBox.width <= countBox.x, `label and count remain separate at ${width}px`);
          }
        }
      }
      for (const name of actionNames) assert.ok(await likedCard.getByRole('button', { name }).isVisible(), `${name} remains visible at ${width}px`);
      assert.equal(await emptyCard.getByRole('button', { name: 'Like', exact: true }).isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `page has no horizontal overflow at ${width}px`);
      if (width === 375) {
        const dismissInstall = page.getByRole('button', { name: 'Dismiss install suggestion' });
        if (await dismissInstall.count()) await dismissInstall.click();
        const artifacts = path.join(__dirname, 'artifacts');
        fs.mkdirSync(artifacts, { recursive: true });
        await page.screenshot({ path: path.join(artifacts, 'social-post-actions-375.png'), fullPage: true });
      }
      console.log(`PASS ${width}px: populated liked/unliked cards, two-column actions, separated content, 44px targets, no overflow`);
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await page.waitForTimeout(120);
    assert.equal(await likedCard.locator('[data-post-actions]').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 4);
    console.log('PASS wider layout: four actions remain on one row');

    await page.setViewportSize({ width: 390, height: 844 });
    await likedCard.getByRole('button', { name: 'Like, 12' }).click();
    await likedCard.getByRole('button', { name: 'Like, 11' }).waitFor();
    await likedCard.getByRole('button', { name: 'React, 10' }).click();
    await page.getByRole('menuitem', { name: /Sticker/ }).waitFor();
    await page.keyboard.press('Escape');
    await likedCard.getByRole('button', { name: 'Comment, 11' }).click();
    await page.getByText('Fictional comment fixture', { exact: true }).waitFor();
    await likedCard.getByRole('button', { name: 'Gift', exact: true }).click();
    await page.getByRole('heading', { name: 'Send a gift to League Friend' }).waitFor();
    console.log('PASS action handlers: mocked like update, reaction menu, comments and gift dialog');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
