import { expect, test } from "@playwright/test";

import { repairDeskStyleReloadedAtKey } from "../../src/shared/lib/app-style-recovery";

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

test("never exposes raw markup on mobile or desktop when the global stylesheet fails", async ({
  page,
}) => {
  await page.addInitScript((reloadKey) => {
    window.sessionStorage.setItem(reloadKey, String(Date.now()));
  }, repairDeskStyleReloadedAtKey);
  await page.route(/\/_next\/static\/.*\.css(?:\?.*)?$/, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const fallback = page.locator("#repairdesk-style-fallback");
  const shell = page.locator("#repairdesk-styled-shell");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("正在恢复 RepairDesk");
  await expect(shell).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(fallback).toBeVisible();
  await expect(shell).toBeHidden();
});

test("keeps raw markup hidden when the complete author style layer disappears", async ({
  page,
}) => {
  await page.addInitScript((reloadKey) => {
    window.sessionStorage.setItem(reloadKey, String(Date.now()));
  }, repairDeskStyleReloadedAtKey);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const fallback = page.locator("#repairdesk-style-fallback");
  const shell = page.locator("#repairdesk-styled-shell");
  await expect(fallback).toBeHidden();
  await expect(shell).toBeVisible();

  await page.evaluate(() => {
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
  });

  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("正在恢复 RepairDesk");
  await expect(shell).toBeHidden();
  await expect
    .poll(() =>
      fallback.evaluate((element) => ({
        display: window.getComputedStyle(element).display,
        position: window.getComputedStyle(element).position,
      })),
    )
    .toEqual({ display: "grid", position: "fixed" });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(fallback).toBeVisible();
  await expect(shell).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(fallback).toBeVisible();
  await expect(shell).toBeHidden();
});

test("automatically reloads once after a stylesheet failure without entering a loop", async ({
  page,
}) => {
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests += 1;
    }
  });
  await page.route(/\/_next\/static\/.*\.css(?:\?.*)?$/, (route) => route.abort("failed"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect.poll(() => documentRequests, { timeout: 6_000 }).toBe(2);
  await page.waitForTimeout(1_750);
  expect(documentRequests).toBe(2);

  const stylesRecovered = await page.evaluate(
    () =>
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--repairdesk-styles-ready")
        .trim() === "1",
  );
  if (stylesRecovered) {
    await expect(page.locator("#repairdesk-style-fallback")).toBeHidden();
    await expect(page.locator("#repairdesk-styled-shell")).toBeVisible();
  } else {
    await expect(page.locator("html")).toHaveAttribute("data-style-recovery", "wait");
    await expect(page.locator("#repairdesk-style-fallback")).toBeVisible();
    await expect(page.locator("#repairdesk-styled-shell")).toBeHidden();
  }
});
