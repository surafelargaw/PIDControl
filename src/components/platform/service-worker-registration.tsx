"use client";

import { useEffect } from "react";

const CACHE_PREFIX = "pid-trainer-";
const DEV_CLEANUP_FLAG = "pid-trainer-dev-sw-cleanup";

async function clearPidTrainerCaches() {
  if (!("caches" in window)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName))
  );
}

async function unregisterServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const hostname = window.location.hostname;
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1";

    if (import.meta.env.DEV || isLocalHost || window.location.protocol !== "https:") {
      const hadController = Boolean(navigator.serviceWorker.controller);

      void Promise.all([unregisterServiceWorkers(), clearPidTrainerCaches()])
        .then(() => {
          if (hadController && !window.sessionStorage.getItem(DEV_CLEANUP_FLAG)) {
            window.sessionStorage.setItem(DEV_CLEANUP_FLAG, "1");
            window.location.reload();
            return;
          }

          window.sessionStorage.removeItem(DEV_CLEANUP_FLAG);
        })
        .catch((error) => {
          console.error("Service worker cleanup failed", error);
        });

      return;
    }

    const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href);
    void navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
