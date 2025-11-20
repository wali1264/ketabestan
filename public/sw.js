
const CACHE_NAME = 'ketabestan-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. Install Event: Force cache key files immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Take control of all clients immediately
});

// 3. Fetch Event: Cache First for core assets, Network First for others
self.addEventListener('fetch', (event) => {
  // Ignore non-GET or API requests (let them go network only or handled differently)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Strategy: Stale-While-Revalidate for most things
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Even if we have it in cache, fetch fresh version in background to update cache for next time
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Check if valid response
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
         // Network failed, nothing to do here as we return cachedResponse below
      });

      // Return cached response immediately if available, else wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
