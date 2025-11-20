
const CACHE_NAME = 'ketabestan-dynamic-v1';

// Install event: Skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: Clean up old caches
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

// Fetch event: Network First, falling back to Cache
// This ensures the user always gets the latest version if online, 
// but the app still loads if offline (satisfying PWA requirements).
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // If valid response, clone and cache it
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return res;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            // Ideally serve a offline.html here if navigating, but for now return undefined
        });
      })
  );
});
