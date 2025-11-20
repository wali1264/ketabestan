
const CACHE_NAME = 'ketabestan-v5-offline';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. Install: Cache Core Assets Only (Fail-safe)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We use map/catch to ensure one missing file doesn't break the whole install
      return Promise.all(
        CORE_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn('SW: Failed to cache critical asset:', url, err);
          });
        })
      );
    })
  );
});

// 2. Activate: Cleanup Old Caches
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
  return self.clients.claim();
});

// 3. Fetch: Stale-While-Revalidate Strategy
// This is crucial for offline functionality. It tries to serve from cache first,
// but also updates the cache from network in the background.
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and cross-origin
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Network request to update cache
      const networkFetch = fetch(event.request).then((networkResponse) => {
        // Clone response to store in cache
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          try {
             // Only cache valid responses
             if(networkResponse.status === 200) {
                cache.put(event.request, responseClone);
             }
          } catch(e) { console.error(e); }
        });
        return networkResponse;
      }).catch(() => {
         // If network fails and no cache (should happen rarely for visited pages)
         if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
         }
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});
