// Offline support: the game files are cached on first visit; photos and voice clips as you meet them.
const V = 'arcadehk-__BUILD__';
const CORE = ['./', 'index.html', 'js/data.js', 'js/icons.js', 'js/app.js', 'js/phaser.js', 'js/tone.js', 'js/zzfx.js', 'js/confetti.js', 'img/map.png?v=__BUILD__', 'img/favicon.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k.startsWith('arcadehk-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const fresh = u.origin === location.origin && /(\/|\.html|\.js|\.webmanifest)$/.test(u.pathname);
  if (fresh) { e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request))); return; }
  if (u.origin === location.origin || u.hostname.endsWith('wikimedia.org')) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => hit)));
  }
});
