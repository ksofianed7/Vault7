// Vault Service Worker — enables PWA install + offline shell caching
const CACHE_NAME = "vault-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: always try the network, fall back to cache for offline
self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Skip non-GET requests
  if (req.method !== "GET") return;
  // Skip cross-origin requests (API calls to yt-dlp etc.)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Skip Next.js hot reload + internal
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful GET responses for next time
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
