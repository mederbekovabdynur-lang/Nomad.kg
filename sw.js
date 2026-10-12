const V = 'kg-guide-v2';
const TILES = 'kg-tiles-v2';
const SHELL = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map(k => c.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Плитки карты: кэшируются по мере просмотра
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(
      caches.open(TILES).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => {
          if (r && r.status === 200) { c.put(req, r.clone()); trim(TILES, 600); }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Страница: сначала сеть, без интернета — кэш
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(V).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Остальное: кэш, потом сеть
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.status === 200 && (url.origin === location.origin || url.hostname === 'unpkg.com')) {
        const copy = r.clone();
        caches.open(V).then(c => c.put(req, copy));
      }
      return r;
    }))
  );
  
});