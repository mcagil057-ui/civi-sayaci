// Çivi Sayacı service worker: uygulamanın çevrimdışı da açılabilmesini sağlar.
// Sürüm adını değiştirmek eski önbelleği temizletir.
const CACHE_NAME = 'civi-sayaci-v12';
const APP_SHELL = './civi-sayaci-1-5.html';
const PRECACHE = [APP_SHELL, './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// Ön-yükleme: dosyalar TEK TEK indirilir; biri başarısız olsa bile kurulum
// tamamlanır (addAll hepsi-ya-da-hiçbiri olduğundan kurulumun tamamını
// çökertebiliyordu). Yanıt, yönlendirme (redirect) bayrağı temizlenerek
// saklanır — yönlendirilmiş bir yanıt gezinmede (navigation) kullanılamaz
// ve uygulamanın boş ekranla açılmasına yol açar.
async function precacheAll() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(PRECACHE.map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'reload' });
      if (res.ok) {
        const body = await res.blob();
        await cache.put(u, new Response(body, { status: 200, headers: res.headers }));
      }
    } catch (e) { /* tek dosya başarısız olsa da kurulum devam etsin */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()));
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
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // API çağrılarına (ntfy, telegram) hiç karışma — her zaman canlı ağ.
  if (url.origin !== self.location.origin && !url.hostname.includes('cdn.jsdelivr.net')) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    // Sayfanın kendisi: önce ağ (güncellemeler hemen gelsin), ağ yoksa önbellek.
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        const cached = (await caches.match(req)) || (await caches.match(APP_SHELL));
        return cached || new Response(
          '<!DOCTYPE html><html lang="tr"><body style="background:#0b0d18;color:#fff;font-family:system-ui;padding:24px;"><h2>📡 Çevrimdışı</h2><p>İlk açılış için internet gerekiyor. Bağlantıyı açıp tekrar dene.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // Statik dosyalar (ikonlar, CDN kütüphaneleri): önce önbellek, yoksa ağ.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
