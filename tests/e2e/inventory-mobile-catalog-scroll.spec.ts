import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidenceDir = path.join(
  process.cwd(),
  "screenshots",
  "TASK-20260727-001-mobile-catalog-popover-scroll",
);

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for inventory catalog checks.");

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("mobile catalog list scrolls inside a stable fixed picker", async ({ page }) => {
  await openCatalogStep(page);

  await page.getByRole("combobox", { name: "品牌 *" }).click();

  const picker = page.locator('[data-inventory-catalog-picker="mobile"]');
  const list = page.locator("[data-inventory-catalog-list]");
  await expect(page.getByRole("dialog", { name: "品牌" })).toBeVisible();
  await expect(list).toBeVisible();
  await page.getByPlaceholder("搜索欧洲常见品牌").focus();
  await page.waitForTimeout(450);

  const beforePickerBox = await picker.boundingBox();
  const beforePageScroll = await page.evaluate(() => window.scrollY);
  expect(beforePickerBox).not.toBeNull();
  const listDimensions = await list.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(listDimensions.scrollHeight).toBeGreaterThan(listDimensions.clientHeight);

  await setListScroll(list, 180);
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
    path: path.join(evidenceDir, "inventory-brand-picker-stable-scroll-mobile-390.png"),
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

async function setListScroll(list: import("@playwright/test").Locator, distance: number) {
  await list.evaluate((element, nextScrollTop) => {
    element.scrollTop = nextScrollTop;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, distance);
}
