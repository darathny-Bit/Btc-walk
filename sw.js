// BTC Walk: keeps the app's own files on the phone so it opens with no signal. Your lines live in the app's storage, not here.
const CACHE = 'btc-walk-2.14.2';
const FILES = ['./', 'index.html', 'app.js?v=21', 'styles.css?v=16', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png?v=2', 'icons/icon-512.png?v=2', 'icons/apple-touch-icon.png?v=2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && !/-fonts$/.test(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // the Geist fonts (2.0): kept on the phone after the first load, so the look holds with no signal
  if (e.request.method === 'GET' && /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE + '-fonts').then((k) => k.put(e.request, c)); return r; })));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // the network first, checked with the site every time (never GitHub's 10-minute copy, 2.0.1), the phone's copy when there's no signal
  e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('index.html'))));
});
