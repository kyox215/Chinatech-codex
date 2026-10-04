// This replaces the formerly installed RepairDesk worker at its exact URL.
// It intentionally has no fetch handler and never navigates an open client.
export const legacyServiceWorkerRetirement = `
"use strict";
const RETIRED_MESSAGE = "chinatech-legacy-worker-retired-v1";
let retired = false;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("repairdesk-shell-"))
      .map((key) => caches.delete(key)));
    retired = true;
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window" });
    for (const client of windows) client.postMessage({ type: RETIRED_MESSAGE });
  })());
});

self.addEventListener("message", (event) => {
  if (retired && event.data?.type === "chinatech-legacy-worker-status-v1") {
    event.ports[0]?.postMessage({ type: RETIRED_MESSAGE });
  }
});
`;
