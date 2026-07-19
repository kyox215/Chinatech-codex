import { expect, test } from "@playwright/test";

import { repairDeskStyleReloadStateKey } from "../../src/shared/lib/app-style-recovery";

type NetworkMode = "offline" | "online" | "probe-only";

const networkControlURL = process.env.REPAIRDESK_E2E_NETWORK_CONTROL_URL;

test.use({ serviceWorkers: "allow" });
test.skip(
  process.env.REPAIRDESK_E2E_PRODUCTION_SW !== "1",
  "requires an explicit production build with Service Worker registration enabled",
);
test.describe.configure({ mode: "serial" });

async function setNetworkMode(
  context: import("@playwright/test").BrowserContext,
  mode: NetworkMode,
) {
  if (!networkControlURL) {
    if (mode === "probe-only") throw new Error("probe-only mode requires the network proxy");
    await context.setOffline(mode === "offline");
    return;
  }
  const response = await fetch(`${networkControlURL}/${mode}`);
  expect(response.ok).toBe(true);
}

async function installProductionServiceWorker(
  context: import("@playwright/test").BrowserContext,
  page: import("@playwright/test").Page,
) {
  await setNetworkMode(context, "online");
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await Promise.all([
      caches.open("repairdesk-shell-v2"),
      caches.open("repairdesk-shell-v3"),
      caches.open("repairdesk-business-sentinel"),
    ]);
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const fallback = await caches
          .open("repairdesk-shell-v4")
          .then((cache) => cache.match("/offline-fallback-v1.html"));
        return {
          businessCachePreserved: keys.includes("repairdesk-business-sentinel"),
          controlled: Boolean(navigator.serviceWorker.controller),
          fallbackCached: Boolean(fallback),
          hasV2: keys.includes("repairdesk-shell-v2"),
          hasV3: keys.includes("repairdesk-shell-v3"),
          hasV4: keys.includes("repairdesk-shell-v4"),
        };
      }),
    )
    .toEqual({
      businessCachePreserved: true,
      controlled: true,
      fallbackCached: true,
      hasV2: false,
      hasV3: false,
      hasV4: true,
    });
}

async function seedPersistenceSentinels(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    document.cookie = "repairdesk-sw-sentinel=keep; path=/; SameSite=Lax";
    window.localStorage.setItem("repairdesk-sw-sentinel", "keep");
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("repairdesk-sw-sentinel", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("state", "readwrite");
        transaction.objectStore("state").put("keep", "value");
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
}

test("recovers the standalone offline shell once and preserves browser state", async ({
  browserName,
  context,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installProductionServiceWorker(context, page);
  await seedPersistenceSentinels(page);

  const nextAssetRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/_next/") || /\.(?:css|js|woff2?)(?:$|\?)/.test(url.pathname)) {
      nextAssetRequests.push(url.pathname);
    }
  });

  await setNetworkMode(context, "offline");
  try {
    if (browserName === "webkit" && !networkControlURL) {
      await page.evaluate(() => window.location.assign("/orders"));
    } else {
      await page.goto("/orders", { waitUntil: "domcontentloaded", timeout: 10_000 });
    }
    await expect(page.locator('html[data-repairdesk-offline-fallback="v1"]')).toBeAttached();
    expect(new URL(page.url()).pathname).toBe("/orders");
    await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
    await expect(page.locator("#repairdesk-style-retry")).toBeVisible({ timeout: 3_000 });
    expect(
      await page.locator('script[src], link[rel="stylesheet"], img[src], source[src]').count(),
    ).toBe(0);
    expect(nextAssetRequests).toEqual([]);

    const reconnectStartedAt = Date.now();
    const recoveryRequests: Array<{ path: string; at: number }> = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        recoveryRequests.push({ path: new URL(request.url()).pathname, at: Date.now() });
      }
    });
    await setNetworkMode(context, "online");

    await expect
      .poll(() => recoveryRequests.length, { timeout: 3_000, intervals: [25, 50, 100] })
      .toBeGreaterThan(0);
    expect(recoveryRequests[0].at - reconnectStartedAt).toBeLessThanOrEqual(3_000);
    await expect(page.locator('html[data-repairdesk-offline-fallback="v1"]')).not.toBeAttached({
      timeout: 8_000,
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => ({
            runtimeReady:
              (window as typeof window & { __repairDeskRuntimeReady?: boolean })
                .__repairDeskRuntimeReady === true,
            styleReady: window
              .getComputedStyle(document.documentElement)
              .getPropertyValue("--repairdesk-styles-ready")
              .trim(),
          })),
        { timeout: 8_000 },
      )
      .toEqual({ runtimeReady: true, styleReady: "1" });
    await expect(page.locator("#repairdesk-style-fallback")).toBeHidden();
    await expect(page.locator("#repairdesk-styled-shell")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/orders");
    await page.waitForTimeout(1_500);
    expect(recoveryRequests.filter((request) => request.path === "/orders")).toHaveLength(1);
    await expect
      .poll(() =>
        page.evaluate(async (reloadStateKey) => {
          const indexedDbValue = await new Promise<string | null>((resolve, reject) => {
            const request = indexedDB.open("repairdesk-sw-sentinel", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const transaction = request.result.transaction("state", "readonly");
              const read = transaction.objectStore("state").get("value");
              read.onsuccess = () => {
                request.result.close();
                resolve(typeof read.result === "string" ? read.result : null);
              };
              read.onerror = () => reject(read.error);
            };
          });
          return {
            cookie: document.cookie.includes("repairdesk-sw-sentinel=keep"),
            indexedDbValue,
            localStorageValue: window.localStorage.getItem("repairdesk-sw-sentinel"),
            reloadState: window.sessionStorage.getItem(reloadStateKey),
          };
        }, repairDeskStyleReloadStateKey),
      )
      .toEqual({
        cookie: true,
        indexedDbValue: "keep",
        localStorageValue: "keep",
        reloadState: null,
      });

    if (process.env.REPAIRDESK_CAPTURE_STYLE_RECOVERY_EVIDENCE === "1") {
      await page.screenshot({
        path: `screenshots/TASK-20260719-007-fast-app-recovery/sw-recovered-${browserName}.png`,
        fullPage: true,
      });
    }

    await page.goto("/offline", { waitUntil: "networkidle" });
    await expect(page.locator('html[data-repairdesk-offline-fallback="v1"]')).not.toBeAttached();
    await expect(page.getByRole("heading", { name: "当前离线" })).toBeVisible();
  } finally {
    await setNetworkMode(context, "online");
  }
});

for (const storageBlocked of [false, true]) {
  test(`does not loop when recovered probes succeed but navigation remains unavailable${
    storageBlocked ? " with session storage blocked" : ""
  }`, async ({ context, page }) => {
    test.skip(!networkControlURL, "requires probe-only network proxy mode");
    await installProductionServiceWorker(context, page);
    if (storageBlocked) {
      await page.addInitScript(() => {
        for (const method of ["getItem", "setItem", "removeItem"] as const) {
          Object.defineProperty(Storage.prototype, method, {
            configurable: true,
            value() {
              throw new DOMException("Storage disabled", "SecurityError");
            },
          });
        }
      });
    }

    await setNetworkMode(context, "offline");
    try {
      await page.goto("/orders", { waitUntil: "domcontentloaded", timeout: 10_000 });
      await expect(page.locator('html[data-repairdesk-offline-fallback="v1"]')).toBeAttached();

      const recoveryRequests: string[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          recoveryRequests.push(new URL(request.url()).pathname);
        }
      });
      await setNetworkMode(context, "probe-only");

      await expect
        .poll(() => recoveryRequests.filter((path) => path === "/orders").length, {
          timeout: 3_000,
          intervals: [25, 50, 100],
        })
        .toBe(1);
      await expect(page.locator('html[data-repairdesk-offline-fallback="v1"]')).toBeAttached();
      await expect(page.locator("#repairdesk-style-retry")).toBeVisible({ timeout: 3_000 });
      await expect(page.locator("#repairdesk-style-status")).toContainText("请立即重试");
      await page.waitForTimeout(3_000);
      expect(recoveryRequests.filter((path) => path === "/orders")).toHaveLength(1);
    } finally {
      await setNetworkMode(context, "online");
    }
  });
}
