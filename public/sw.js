// ponytail: hand-rolled service worker — no workbox dependency.
// Strategy: stale-while-revalidate for assets, network-first for pages, cache-first for images.
// Ceiling: single SW instance, 50-entry LRU per cache. Upgrade path: workbox if more granular control needed.
const CACHE_VERSION = 'umkm-sv-v1';
const CACHES = {
  static: `${CACHE_VERSION}-static`,
  images: `${CACHE_VERSION}-images`,
  pages: `${CACHE_VERSION}-pages`,
};
const MAX_ENTRIES = 50;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Routes that should NEVER be cached (need fresh data)
const NO_CACHE = [/^\/admin/, /^\/api\//, /^\/dashboard/, /^\/masuk/, /^\/daftar/];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHES.static).then((c) => c.addAll([
      '/',
      '/manifest.webmanifest',
      '/favicon-32.png',
      '/favicon-16.png',
      '/apple-touch-icon.png',
      '/pwa-192x192.png',
      '/pwa-512x512.png',
    ])).catch(() => {}) // best-effort precache
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function shouldSkip(url) {
  return NO_CACHE.some((re) => re.test(url.pathname));
}

function trimCache(name) {
  caches.open(name).then((cache) =>
    cache.keys().then((keys) => {
      if (keys.length > MAX_ENTRIES) cache.delete(keys[0]);
    })
  );
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (supabase etc)
  if (shouldSkip(url)) return; // let network handle it

  const isImage = /\.(?:png|jpe?g|svg|gif|webp|ico)$/i.test(url.pathname);
  const isAsset = /\.(?:css|js|woff2?|ttf)$/i.test(url.pathname);

  if (isImage) {
    // Cache-first for images
    e.respondWith(
      caches.open(CACHES.images).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) { cache.put(request, res.clone()); trimCache(CACHES.images); }
            return res;
          });
        })
      )
    );
  } else if (isAsset) {
    // Stale-while-revalidate for CSS/JS/fonts
    e.respondWith(
      caches.open(CACHES.static).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((res) => {
            if (res.ok) { cache.put(request, res.clone()); trimCache(CACHES.static); }
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // Network-first for pages (HTML)
    e.respondWith(
      fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHES.pages).then((cache) => { cache.put(request, copy); trimCache(CACHES.pages); });
        return res;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
  }
});
