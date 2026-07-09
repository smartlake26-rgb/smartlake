// ============================================================
//  public/sw.js — SmartLake 2.0 Progressive Web App Service Worker
//  Implements offline shell caching and static assets availability.
//  Bypasses Firestore API calls to let Firebase handles its own cache.
// ============================================================

const CACHE_NAME = 'smartlake-pwa-v2.0.5';
const ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Let Firestore and other Google auth APIs handle their own offline capabilities
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com')) {
    return;
  }

  // Network-First (Network falling back to Cache)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache static local files only (do not cache third-party or chrome-extensions)
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          url.startsWith(self.location.origin)
        ) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Safe navigation fallback if offline and not in cache
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
