// Çivi Sayacı service worker: uygulamanın çevrimdışı da açılabilmesini sağlar.
// Sürüm adını değiştirmek eski önbelleği temizletir.
const CACHE_NAME = 'civi-sayaci-v1';
const PRECACHE = [
  './civi-sayaci-1-5.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API çağrılarına (ntfy, telegram, jsonblob) hiç karışma — her zaman canlı ağ.
  if (url.origin !== self.location.origin && !url.hostname.includes('cdn.jsdelivr.net')) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // Sayfanın kendisi: önce ağ (güncellemeler hemen gelsin), ağ yoksa önbellek.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./civi-sayaci-1-5.html')))
    );
    return;
  }

  // Statik dosyalar (ikonlar, CDN kütüphaneleri): önce önbellek, yoksa ağ.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
