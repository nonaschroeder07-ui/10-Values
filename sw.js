// Service worker: сохраняет приложение на устройстве, чтобы оно открывалось без интернета.
// Стратегия: сразу отдаём сохранённую копию, а в фоне скачиваем свежую.
// После любого изменения файлов приложения увеличить VERSION.
const VERSION = 'v5';
const PDF_LIB_ORIGIN = 'https://cdnjs.cloudflare.com';
const CACHE = 'values-free-' + VERSION;
const FILES = [
  './', 'index.html', 'app.js', 'content.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('values-free-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      const origin = new URL(req.url).origin;
      if (res && res.ok && (origin === location.origin || origin === PDF_LIB_ORIGIN)) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || (await cache.match('index.html')) || Response.error();
  })());
});
