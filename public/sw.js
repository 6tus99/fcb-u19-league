/* FCB U19 — service worker (PWA app-shell caching).
 *
 * Strategy:
 *  - Page navigations: network first, fall back to the cached shell
 *    when the phone has no data (offline).
 *  - Hashed build assets (/static/...) and icons: cache first —
 *    their names change on every deploy, so a cached copy is never stale.
 *  - Anything else (Supabase API, realtime, storage) is left untouched.
 *
 * Bump VERSION to purge old caches on the next visit.
 */
const VERSION = 'fcb-u19-v8';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(['/']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache supabase/co

  // 1) App navigations -> network first, cached shell as offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 2) Immutable build assets + icons -> cache first
  const isAsset =
    url.pathname.startsWith('/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.svg';
  if (isAsset) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(req, copy));
            return res;
          })
      )
    );
  }
});
