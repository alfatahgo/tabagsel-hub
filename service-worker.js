// ============================================================
// TABAGSEL HUB - Service Worker (PWA Offline Support)
// ============================================================
const CACHE_NAME = 'tabagsel-hub-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/admin.html',
  '/offline.html',
  '/assets/images/logo-tabagsel-hub.svg',
  '/js/config.js',
  '/js/app.js',
  '/js/supabase-client.js',
  '/css/style.css',
  '/manifest.json',
];

// Install: Cache core assets (tangguh terhadap variasi path)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(asset);
        } catch (e) {
          console.warn('Gagal cache asset PWA:', asset, e);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first with cache fallback & offline.html support
self.addEventListener('fetch', (event) => {
  // Skip non-GET and Supabase/Cloudinary API requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase') || url.hostname.includes('cloudinary')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      })
  );
});
