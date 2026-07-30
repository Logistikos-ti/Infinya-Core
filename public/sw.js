// Bumped from v3: the previous version cached every same-origin GET
// cache-first and never revalidated, which included RSC payloads (the actual
// page data). Collectors kept showing records that had already been completed
// or deleted. Renaming the cache makes the activate handler purge the stale one.
const CACHE_NAME = "infinoos-wms-pwa-v4";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/branding/infinoos-mark-192.png",
  "/branding/infinoos-mark-512.png",
  "/branding/infinoos-mark-maskable-512.png",
  "/m",
  "/m/login",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Only build output and media are safe to serve from cache. Everything else
 * (documents, RSC payloads, API responses) reflects live warehouse state and
 * must come from the network.
 */
function isCacheableAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname === "/manifest.webmanifest") return true;
  return /\.(?:png|jpe?g|svg|webp|avif|gif|ico|woff2?|ttf)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  // Page loads: always hit the network, falling back to the cached login shell
  // only when the device is genuinely offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/m/login")) || Response.error();
      }),
    );
    return;
  }

  // Anything that is not a static asset — RSC payloads (`?_rsc=`), API routes,
  // server action responses — is left entirely to the network so the collector
  // never renders stale data.
  if (!isCacheableAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        // Only store complete, successful responses; caching an opaque or error
        // response would pin a broken asset until the next cache bump.
        if (response.ok && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      });
    }),
  );
});
