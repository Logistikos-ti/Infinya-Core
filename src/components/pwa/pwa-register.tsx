"use client";

import { useEffect } from "react";

/**
 * The old PWA service worker (public/sw.js versions v3/v4) intercepted every
 * same-origin GET with a cache-first policy and could hang authenticated
 * pages for minutes on the client while the server itself was healthy. To
 * unwind that cleanly across the existing install base, we no longer
 * register a service worker here; instead this component actively unregisters
 * any leftover SW and wipes its caches, so users who still had the bad SW
 * installed are back to a plain browser on the next visit.
 *
 * The /sw.js file that IS still served is a self-destructing kill switch —
 * clients that already had it installed will fetch the new version on their
 * next navigation (updateViaCache: "none" was set on the old registration),
 * it activates, deletes every cache, unregisters itself, and reloads the
 * page. This client-side sweep here is the belt-and-suspenders backup for
 * cases where the SW update didn't take.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const cleanup = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch (error) {
        console.warn("Falha ao limpar service worker antigo.", error);
      }
    };

    void cleanup();
  }, []);

  return null;
}
