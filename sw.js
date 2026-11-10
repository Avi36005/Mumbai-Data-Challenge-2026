// Mumbai AirPulse service worker: app shell + data cached so the forecast opens offline; network first for data so updates show.
const CACHE = 'airpulse-202611101851';
const SHELL = ['./', 'index.html', 'app.css?v=202611101851', 'app.js?v=202611101851', 'i18n.js?v=202611101851', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'data/city.json', 'data/wards.geo.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
