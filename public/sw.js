
const CACHE_NAME = 'ketabestan-v8-final-icons';
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
      console.log('SW: Opening cache and starting pre-cache...');
      return Promise.all(
        CORE_ASSETS.map(url => {
          return cache.add(url)
            .then(() => console.log(`SW: Successfully cached ${url}`))
            .catch(err => console.error(`SW: Failed to cache ${url}. Check if file exists.`, err));
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
          console.log('SW: Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Network First, falling back to Cache
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
             // Fallback for navigation requests (SPA support)
             if (event.request.mode === 'navigate') {
                 return caches.match('/index.html');
             }
             return new Response("Offline", { status: 503, statusText: "Offline" });
         });
      })
  );
});
