// Offline support. Network first, so a new version always wins; the saved copy is only used with no connection.
const CACHE = 'monkey-jones-1';
const CORE = ['./', 'index.html', 'three.min.js', 'fonts/rammetto-one.woff2', 'fonts/fredoka-500.woff2', 'fonts/fredoka-600.woff2', 'fonts/fredoka-700.woff2', 'icon-192.png', 'manifest.webmanifest', 'version.json'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
