import { expect, test } from "@playwright/test";

import {
  repairDeskStyleMaxAutoReloads,
  repairDeskStyleRecoveryProbeToken,
  repairDeskStyleReloadStateKey,
} from "../../src/shared/lib/app-style-recovery";

const cssAssetPattern = /\/_next\/static\/.*\.css(?:\?.*)?$/;
const jsAssetPattern = /\/_next\/static\/.*\.js(?:\?.*)?$/;
const recoveryProbePattern = "**/recovery-probe.txt**";

test.use({ serviceWorkers: "block" });

async function seedReloadLimit(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ stateKey, maxAutoReloads }) => {
      window.sessionStorage.setItem(
        stateKey,
        JSON.stringify({
          version: 2,
          windowStartedAt: Date.now(),
          autoReloadCount: maxAutoReloads,
          lastAutoReloadAt: Date.now(),
        }),
      );
    },
    { stateKey: repairDeskStyleReloadStateKey, maxAutoReloads: repairDeskStyleMaxAutoReloads },
  );
}

test("keeps the mobile and desktop application shell visible when styles are ready", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#repairdesk-style-fallback")).toBeHidden();
  await expect(page.locator("#repairdesk-styled-shell")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .getComputedStyle(document.documentElement)
          .getPropertyValue("--repairdesk-styles-ready")
          .trim(),
      ),
    )
    .toBe("1");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#repairdesk-style-fallback")).toBeHidden();
  await expect(page.locator("#repairdesk-styled-shell")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("never exposes raw markup and provides a reachable manual action when styles stay missing", async ({
  page,
}) => {
  await seedReloadLimit(page);
  await page.route(cssAssetPattern, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const fallback = page.locator("#repairdesk-style-fallback");
  const shell = page.locator("#repairdesk-styled-shell");
  const retry = page.locator("#repairdesk-style-retry");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("RepairDesk");
  await expect(shell).toBeHidden();
  await expect(retry).toBeVisible({ timeout: 3_000 });
  expect(
    await retry.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (process.env.REPAIRDESK_CAPTURE_STYLE_RECOVERY_EVIDENCE === "1") {
    await page.screenshot({
      path: "screenshots/TASK-20260719-007-fast-app-recovery/manual-recovery-mobile.png",
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(fallback).toBeVisible();
  await expect(shell).toBeHidden();
  await expect(retry).toBeVisible({ timeout: 3_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (process.env.REPAIRDESK_CAPTURE_STYLE_RECOVERY_EVIDENCE === "1") {
    await page.screenshot({
      path: "screenshots/TASK-20260719-007-fast-app-recovery/manual-recovery-desktop.png",
      fullPage: true,
    });
  }
});

test("keeps raw markup hidden when the author style layer disappears after startup", async ({
  page,
}) => {
  await page.route(recoveryProbePattern, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const fallback = page.locator("#repairdesk-style-fallback");
  const shell = page.locator("#repairdesk-styled-shell");
  await expect(fallback).toBeHidden();
  await expect(shell).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as typeof window & { __repairDeskRuntimeReady?: boolean })
              .__repairDeskRuntimeReady === true,
        ),
      { timeout: 3_000 },
    )
    .toBe(true);

  await page.evaluate(() => {
    document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
    document
      .querySelectorAll("style:not(#repairdesk-critical-style-guard)")
      .forEach((node) => node.remove());
    window.dispatchEvent(new Event("pageshow"));
  });

  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("RepairDesk");
  await expect(shell).toBeHidden();
  await expect
    .poll(() =>
      fallback.evaluate((element) => ({
        display: window.getComputedStyle(element).display,
        position: window.getComputedStyle(element).position,
      })),
    )
    .toEqual({ display: "grid", position: "fixed" });
});

test("restores styles directly within three seconds when the React runtime is still alive", async ({
  page,
}) => {
  let assetsReachable = false;
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });
  await page.route(cssAssetPattern, (route) =>
    assetsReachable ? route.continue() : route.abort("failed"),
  );
  await page.route(recoveryProbePattern, (route) =>
    assetsReachable
      ? route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: repairDeskStyleRecoveryProbeToken,
        })
      : route.abort("failed"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as typeof window & { __repairDeskRuntimeReady?: boolean })
              .__repairDeskRuntimeReady === true,
        ),
      { timeout: 3_000 },
    )
    .toBe(true);

  const reachableAt = Date.now();
  assetsReachable = true;
  await expect(page.locator("#repairdesk-style-fallback")).toBeHidden({ timeout: 3_000 });
  expect(Date.now() - reachableAt).toBeLessThanOrEqual(3_000);
  expect(documentRequests).toBe(1);
  const emailInput = page.getByLabel("邮箱").first();
  await emailInput.fill("qa@example.com");
  await expect(emailInput).toHaveValue("qa@example.com");
});

test("refreshes within three seconds when JavaScript was missing and never leaves a false ready shell", async ({
  page,
}) => {
  let assetsReachable = false;
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });
  await page.route(jsAssetPattern, (route) =>
    assetsReachable ? route.continue() : route.abort("failed"),
  );
  await page.route(recoveryProbePattern, (route) =>
    assetsReachable
      ? route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: repairDeskStyleRecoveryProbeToken,
        })
      : route.abort("failed"),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
  await expect(page.locator("#repairdesk-styled-shell")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .getComputedStyle(document.documentElement)
          .getPropertyValue("--repairdesk-styles-ready")
          .trim(),
      ),
    )
    .toBe("1");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __repairDeskRuntimeReady?: boolean })
          .__repairDeskRuntimeReady === true,
    ),
  ).toBe(false);

  await page.waitForTimeout(1_300);
  await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
  await expect(page.locator("#repairdesk-styled-shell")).toBeHidden();

  const reachableAt = Date.now();
  assetsReachable = true;
  await expect.poll(() => documentRequests, { timeout: 3_000, intervals: [50] }).toBe(2);
  expect(Date.now() - reachableAt).toBeLessThanOrEqual(3_000);
  const emailInput = page.getByLabel("邮箱").first();
  const retry = page.locator("#repairdesk-style-retry");
  await expect
    .poll(async () => (await emailInput.isVisible()) || (await retry.isVisible()), {
      timeout: 3_000,
    })
    .toBe(true);
  if (await emailInput.isVisible()) {
    await emailInput.fill("qa@example.com");
    await expect(emailInput).toHaveValue("qa@example.com");
  } else {
    await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
    await expect(page.locator("#repairdesk-styled-shell")).toBeHidden();
    await expect(retry).toBeVisible();
  }
});

test("automatically reloads only once and then offers manual recovery", async ({ page }) => {
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });
  await page.route(cssAssetPattern, (route) => route.abort("failed"));
  await page.route(recoveryProbePattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: repairDeskStyleRecoveryProbeToken,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect.poll(() => documentRequests, { timeout: 3_000 }).toBe(2);
  const retry = page.locator("#repairdesk-style-retry");
  await expect(retry).toBeVisible({ timeout: 3_000 });
  await page.waitForTimeout(8_000);
  expect(documentRequests).toBe(2);

  const clickedAt = Date.now();
  await retry.click();
  await expect.poll(() => documentRequests, { timeout: 1_000, intervals: [25] }).toBe(3);
  expect(Date.now() - clickedAt).toBeLessThanOrEqual(300);
});

test("storage restrictions allow at most one automatic reload", async ({ page }) => {
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });
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
  await page.route(cssAssetPattern, (route) => route.abort("failed"));
  await page.route(recoveryProbePattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: repairDeskStyleRecoveryProbeToken,
    }),
  );
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect.poll(() => documentRequests, { timeout: 3_000 }).toBe(2);
  await expect(page.locator("#repairdesk-style-retry")).toBeVisible({ timeout: 3_000 });
  await page.waitForTimeout(3_000);
  expect(documentRequests).toBe(2);
});

test("keeps recovery actions usable when reduced motion is requested", async ({ page }) => {
  await seedReloadLimit(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(cssAssetPattern, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#repairdesk-style-retry")).toBeVisible({ timeout: 3_000 });
  await expect(page.locator('#repairdesk-style-fallback span[aria-hidden="true"]')).toHaveCSS(
    "animation-name",
    "none",
  );
});
