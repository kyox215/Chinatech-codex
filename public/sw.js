const CACHE_NAME = "repairdesk-shell-v5";
const OFFLINE_FALLBACK_URL = "/offline-fallback-v1.html";
const STATIC_ASSETS = [OFFLINE_FALLBACK_URL];
const NAVIGATION_TIMEOUT_MS = 3_000;

async function fetchNavigation(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getOfflineNavigationResponse() {
  return (
    (await caches.match(OFFLINE_FALLBACK_URL)) ||
    new Response("RepairDesk is offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("repairdesk-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "navigate" && request.method === "GET") {
    event.respondWith(fetchNavigation(request).catch(() => getOfflineNavigationResponse()));
    return;
  }

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
