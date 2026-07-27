import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = path.join(
  process.cwd(),
  "screenshots",
  "TASK-20260727-004-mobile-catalog-picker-release",
);

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for inventory catalog checks.");

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("mobile picker opens without the keyboard and scrolls from a browser gesture", async ({
  page,
  browserName,
}) => {
  await openCatalogStep(page);

  await page.getByRole("combobox", { name: "品牌 *" }).click();

  const picker = page.locator('[data-inventory-catalog-picker="mobile"]');
  const list = page.locator("[data-inventory-catalog-list]");
  const search = page.locator("[data-inventory-catalog-search]");
  await expect(page.getByRole("dialog", { name: "品牌" })).toBeVisible();
  await expect(list).toBeVisible();
  await expect(search).not.toBeFocused();
  await expect(page.getByRole("option", { name: "Apple" })).toBeVisible();
  await page.waitForTimeout(550);

  const beforePickerBox = await picker.boundingBox();
  const beforePageScroll = await page.evaluate(() => window.scrollY);
  expect(beforePickerBox).not.toBeNull();
  const listDimensions = await list.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(listDimensions.scrollHeight).toBeGreaterThan(listDimensions.clientHeight);

  await scrollListWithBrowserGesture(page, list, browserName);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const afterPickerBox = await picker.boundingBox();
  const afterPageScroll = await page.evaluate(() => window.scrollY);
  expect(afterPickerBox).not.toBeNull();
  expect(Math.abs((afterPickerBox?.y ?? 0) - (beforePickerBox?.y ?? 0))).toBeLessThanOrEqual(2);
  expect(
    Math.abs((afterPickerBox?.height ?? 0) - (beforePickerBox?.height ?? 0)),
  ).toBeLessThanOrEqual(2);
  expect(afterPageScroll).toBe(beforePageScroll);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, `inventory-brand-picker-list-first-mobile-390-${browserName}.png`),
  });

  await search.click();
  await expect(search).toBeFocused();
  await search.fill("Fairphone manual");
  await expect(page.getByRole("option", { name: "使用“Fairphone manual”" })).toBeVisible();
});

test.describe("touch tablet compatibility", () => {
  test.use({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });

  test("uses a fixed picker without automatic search focus", async ({ page }) => {
    await openCatalogStep(page);
    await page.getByRole("combobox", { name: "品牌 *" }).click();

    await expect(page.locator('[data-inventory-catalog-picker="mobile"]')).toBeVisible();
    await expect(page.locator("[data-inventory-catalog-search]")).not.toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      820,
    );
  });
});

test.describe("desktop compatibility", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("keeps the anchored desktop catalog picker", async ({ page }) => {
    await openCatalogStep(page);
    await page.getByRole("combobox", { name: "品牌 *" }).click();

    await expect(page.locator('[data-inventory-catalog-command="desktop"]')).toBeVisible();
    await expect(page.locator('[data-inventory-catalog-picker="mobile"]')).toHaveCount(0);
    await page.getByRole("option", { name: "Apple" }).click();
    await expect(page.getByRole("combobox", { name: "品牌 *" })).toContainText("Apple");
  });
});

async function openCatalogStep(page: import("@playwright/test").Page) {
  await page.goto("/inventory/new");
  await expect(page.getByRole("heading", { name: "选择商品来源" })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
}

async function scrollListWithBrowserGesture(
  page: import("@playwright/test").Page,
  list: import("@playwright/test").Locator,
  browserName: string,
) {
  const box = await list.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const visibleTop = Math.max(box?.y ?? 0, 0);
  const visibleBottom = Math.min((box?.y ?? 0) + (box?.height ?? 0), viewport?.height ?? 0);
  const x = Math.round(
    Math.min(Math.max((box?.x ?? 0) + (box?.width ?? 0) / 2, 1), (viewport?.width ?? 1) - 2),
  );
  const y = Math.round(
    Math.min(
      Math.max(visibleTop + Math.max((visibleBottom - visibleTop) / 2, 1), 1),
      (viewport?.height ?? 1) - 2,
    ),
  );

  if (browserName === "chromium") {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.synthesizeScrollGesture", {
      x,
      y,
      yDistance: -180,
      speed: 600,
      gestureSourceType: "touch",
    });
    return;
  }

  // Playwright mobile WebKit does not expose a swipe/wheel primitive. Chromium above
  // covers native touch input; WebKit still verifies the same element owns scroll.
  await list.evaluate((element) => {
    element.scrollTop = 180;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
}
