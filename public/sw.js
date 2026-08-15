const CACHE_VERSION = "somos-pwa-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/brand/new-somos-preview/favicon-preview-32.png",
  "/brand/new-somos-preview/apple-touch-icon-preview.png",
  "/brand/new-somos-preview/somos-icon-preview-192.png",
  "/brand/new-somos-preview/somos-icon-preview-512.png",
  "/brand/new-somos-preview/somos-icon-preview-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vendeplus-") && !key.startsWith(CACHE_VERSION))
            .concat(keys.filter((key) => key.startsWith("somos-") && !key.startsWith(CACHE_VERSION)))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const pathname = requestUrl.pathname;
  const isPrivateRoute =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/panel") ||
    pathname.startsWith("/admin");

  if (isPrivateRoute) return;

  const isStaticAsset =
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/new-somos-preview/") ||
    pathname === "/manifest.webmanifest";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);

      const networkResponse = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || networkResponse;
    })
  );
});
