/**
 * HIKMAT TANI - Service Worker (Offline-First App Shell)
 * 
 * Prinsip:
 * - Meng-cache file shell aplikasi (HTML, JS, CSS, Asset Statis) untuk penggunaan 100% offline di sawah.
 * - TIDAK meng-cache API server atau data IndexedDB pengguna (Data pengguna murni di IndexedDB).
 * - Kebijakan Stale-While-Revalidate untuk aset statis agar pembaruan tetap masuk saat online.
 */

const CACHE_NAME = 'hikmat-tani-shell-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/logo-hikmat-tani-full.png',
  '/favicon-64.png',
  '/favicon-32.png',
  '/brand-sheet-original.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Cache shell prefetch warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Hanya proses request GET berbasis HTTP/HTTPS
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return;

  // Jangan tangani API atau websocket
  if (request.url.includes('/api/') || request.url.includes('vite-hmr')) {
    return;
  }

  // Strategi: Network First dengan fallback ke Cache untuk dokumen HTML navigasi,
  // dan Stale-While-Revalidate untuk aset statis (JS/CSS/Image)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
