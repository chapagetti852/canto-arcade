// Canto Town offline: the front page (the open world) and everything it loads, so the home-screen app opens
// without a connection. Network first (you always get the newest version online), the cache when offline.
// 香港通's own pages keep their worker (games/hk-map/sw.js); this one covers the site root.
const V = 'cantotown-1';
const CORE = ['./', 'manifest.webmanifest', 'favicon.svg', 'favicon.png', 'apple-touch-icon.png',
  'games/hk-map/js/app.js', 'games/hk-map/js/phaser.js', 'games/hk-map/js/data.js', 'games/hk-map/js/icons.js',
  'games/hk-map/js/tone.js', 'games/hk-map/js/zzfx.js', 'games/hk-map/js/confetti.js'];
self.addEventListener('install', (e) => {
  // one missing file must not stop the rest from being saved
  e.waitUntil(caches.open(V).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k.startsWith('cantotown-')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: u.pathname.endsWith('/') })));
});
