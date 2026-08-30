/* Tilavet service worker
 *
 * Kur'an metni değişmeyen bir veridir: bir kez indirilen sûre dosyası
 * kalıcı olarak önbellekte tutulur ve uygulama çevrimdışı da açılır.
 * Sürüm adını değiştirmek eski önbelleği temizletir. */
const SURUM = 'tilavet-v1';
const KABUK = [
  './', './index.html', './app.js', './engine.js', './manifest.json',
  './data/meta.json', './fonts/AmiriQuran-Regular.ttf',
  './icons/icon-192.png', './icons/icon-512.png'
];

// Dosyalar tek tek indirilir: biri başarısız olsa da kurulum tamamlanır
// (addAll hepsi-ya-da-hiçbiri olduğu için tek bir hata kurulumu çökertiyor).
async function onYukle() {
  const onbellek = await caches.open(SURUM);
  await Promise.allSettled(KABUK.map(async (u) => {
    try {
      const y = await fetch(u, { cache: 'reload' });
      if (y.ok) await onbellek.put(u, new Response(await y.blob(), { status: 200, headers: y.headers }));
    } catch (e) { /* tek dosya atlanabilir */ }
  }));
}

self.addEventListener('install', (e) => { e.waitUntil(onYukle().then(() => self.skipWaiting())); });

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const adlar = await caches.keys();
    await Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;      // ses ve yazı tipleri ağdan

  // Kur'an verisi hiç değişmez: önbellek varsa ağa hiç çıkma.
  if (url.pathname.includes('/data/') || url.pathname.includes('/fonts/')) {
    e.respondWith((async () => {
      const onbellek = await caches.open(SURUM);
      const varsa = await onbellek.match(istek);
      if (varsa) return varsa;
      const yanit = await fetch(istek);
      if (yanit.ok) onbellek.put(istek, yanit.clone());
      return yanit;
    })());
    return;
  }

  // Uygulama kabuğu: önbellekten ver, arka planda tazele.
  e.respondWith((async () => {
    const onbellek = await caches.open(SURUM);
    const varsa = await onbellek.match(istek, { ignoreSearch: true });
    const ag = fetch(istek).then((y) => {
      if (y.ok && y.type === 'basic') onbellek.put(istek, y.clone());
      return y;
    }).catch(() => null);
    if (varsa) { ag; return varsa; }
    const yanit = await ag;
    if (yanit) return yanit;
    return caches.match('./index.html');
  })());
});
