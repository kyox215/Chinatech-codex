const legacyWorkerPath = "/sw.js";

export function isLegacyRepairDeskRegistration(
  registration: ServiceWorkerRegistration,
  origin: string,
): boolean {
  if (registration.scope !== `${origin}/`) return false;
  const workers = [registration.active, registration.waiting, registration.installing]
    .filter((worker): worker is ServiceWorker => worker !== null);
  return workers.length > 0 && workers.every((worker) => {
    const url = new URL(worker.scriptURL);
    return url.origin === origin && url.pathname === legacyWorkerPath && !url.search;
  });
}

export async function requestLegacyServiceWorkerRetirement(
  serviceWorkers: ServiceWorkerContainer,
  origin: string,
): Promise<void> {
  const registrations = await serviceWorkers.getRegistrations();
  await Promise.allSettled(registrations
    .filter((registration) => isLegacyRepairDeskRegistration(registration, origin))
    .map((registration) => registration.update()));
  // A failed update leaves the old worker and its offline shell intact. The
  // replacement /sw.js owns deletion and unregistration after activation.
}
