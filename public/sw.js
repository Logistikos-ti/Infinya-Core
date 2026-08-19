// Self-destructing service worker.
//
// Prior versions (v3, and v4 under some cache states) intercepted every
// same-origin GET with a cache-first policy and could hang authenticated
// pages for MINUTES on the client, while the server itself was fine — the
// SW was serving stale HTML shells that then made requests against paths
// that no longer matched the current build. Users had to manually go to
// DevTools → Application → Service Workers → Unregister to recover.
//
// This SW takes control on the first navigation after it is fetched, wipes
// every cache, unregisters itself so no more fetch events are intercepted,
// and force-reloads every open tab so users see the fresh app without
// having to click reload. On the next navigation the client script
// (PwaRegister) does NOT register a new SW, so nothing takes over again.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Wipe every cache the old SW may have left behind.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // 2. Unregister this SW so no more fetch events are intercepted.
      try {
        await self.registration.unregister();
      } catch {
        // Best-effort; if unregister fails the fetch handler below is a no-op
        // anyway, so the browser proceeds normally.
      }

      // 3. Force every open tab to reload against the network so users see
      //    the fresh app immediately, without a manual refresh.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          await client.navigate(client.url);
        } catch {
          // Some clients (cross-origin, closed) reject; ignore.
        }
      }
    })(),
  );
});

// Never intercept requests. If the browser fires a fetch event before
// unregister() completes, do nothing — the browser proceeds with a normal
// network fetch. Calling respondWith() with anything (even a passthrough)
// is exactly the kind of thing that caused this outage.
self.addEventListener("fetch", () => {});
