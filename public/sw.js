const CACHE_NAME = "pid-trainer-v2";
const APP_SHELL_ROUTES = [
  "/",
  "/lab",
  "/stability-lab",
  "/learn",
  "/scenarios",
  "/saved-runs",
  "/instructor",
  "/leaderboard",
  "/profile"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ROUTES))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("pid-trainer-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ).then(() => self.clients.claim())
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) ?? caches.match("/"))
    );

    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse ?? fetch(event.request))
  );
});
