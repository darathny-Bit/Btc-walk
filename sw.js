// BTC Walk: keeps the app's own files on the phone so it opens with no signal. Your lines live in the app's storage, not here.
const CACHE = 'btc-walk-1.7';
const FILES = ['./', 'index.html', 'app.js?v=9', 'styles.css?v=6', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png?v=2', 'icons/icon-512.png?v=2', 'icons/apple-touch-icon.png?v=2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // the network first (so a new version arrives), the phone's copy when there's no signal
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match('index.html'))));
});
