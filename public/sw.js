
const CACHE_NAME = 'ketabestan-pwa-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
  // Note: Icons are removed from here to prevent installation failure if they return 404.
  // The browser will still fetch them for the UI, but the SW won't crash.
];

// 1. Install Event: Cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching critical assets');
      // Using cache.addAll is atomic. If one fails, all fail.
      // Since we only list '/' and index/manifest, this is safe.
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error('SW: Cache addAll failed', err);
      });
    })
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('SW: Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Take control of all clients
});

// 3. Fetch Event: Network First for Documents, Cache First for Assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Navigation requests (HTML pages) -> Network First, fall back to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('/index.html'); // Fallback to offline page
        })
    );
    return;
  }

  // Asset requests (JS, CSS, Images) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
             caches.open(CACHE_NAME).then((cache) => {
                 cache.put(event.request, networkResponse.clone());
             });
        }
        return networkResponse;
      }).catch(e => console.log('SW: Fetch failed (offline)', e));

      return cachedResponse || fetchPromise;
    })
  );
});
