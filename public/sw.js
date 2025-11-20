
const CACHE_NAME = 'ketabestan-v7-custom-icons';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. Install: Cache Core Assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map(url => {
          return cache.add(url).catch(err => {
            console.warn('SW: Warning - Failed to cache asset:', url, err);
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

// 3. Fetch: Network First for freshness, fallback to Cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests, cross-origin, and data URIs
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin) || event.request.url.startsWith('data:')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Clone and cache valid responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
             });
        }
        return networkResponse;
      })
      .catch(() => {
         // Network failed, try cache
         return caches.match(event.request).then((cachedResponse) => {
             if (cachedResponse) return cachedResponse;
             // Fallback for navigation requests
             if (event.request.mode === 'navigate') {
                 return caches.match('/index.html');
             }
             return new Response("Offline", { status: 503, statusText: "Offline" });
         });
      })
  );
});