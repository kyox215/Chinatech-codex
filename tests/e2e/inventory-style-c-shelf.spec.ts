import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260807-004-inventory-lifecycle-implementation/style-c",
);

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await mockShelf(page);
});

test("Style C keeps compact categories and a responsive image shelf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");

  const mobileCategories = page.locator('[data-ui="inventory-product-category-tabs"]:visible');
  await expect(mobileCategories.getByRole("button")).toHaveCount(6);
  await expect(mobileCategories.getByRole("button", { name: "全部" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByAltText(/Apple，iPhone 15 Pro/)).toBeVisible();
  await expect(page.getByText("暂无图片").first()).toBeVisible();
  await assertGridColumns(page, 1);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(screenshotDir, "390-inventory-style-c-shelf.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload();
  await assertGridColumns(page, 2);
  await assertNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.reload();
  await assertGridColumns(page, 3);
  await assertNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  const desktopCategories = page.locator('[data-ui="inventory-product-category-tabs"]:visible');
  await expect(desktopCategories.getByRole("button")).toHaveCount(6);
  await assertGridColumns(page, 4);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(screenshotDir, "1280-inventory-style-c-shelf.png"),
    fullPage: true,
  });
});

async function mockShelf(page: Page) {
  await page.route("**/test-device-photo/*.svg", async (route) => {
    const label = route.request().url().includes("iphone") ? "iPhone" : "iPad";
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" rx="32" fill="#e8eef7"/><rect x="170" y="34" width="140" height="292" rx="26" fill="#182230"/><rect x="182" y="54" width="116" height="232" rx="18" fill="#8aa4c7"/><text x="240" y="315" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#ffffff">${label}</text></svg>`,
    });
  });
  await page.route("**/api/repairdesk/inventory/products/list", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            product({
              id: "style-c-1",
              sku: "CT-PH-0260",
              category: "phone",
              brand: "Apple",
              model: "iPhone 15 Pro",
              specification: "256GB · 原色钛金属",
              location: "展柜 A03",
              list_price: 799,
              thumbnail_url: "/test-device-photo/iphone.svg",
            }),
            product({
              id: "style-c-2",
              sku: "CT-TB-0184",
              category: "tablet",
              brand: "Apple",
              model: "iPad Air 5",
              specification: "64GB · 蓝色",
              status: "reserved",
              location: "展柜 B01",
              list_price: 399,
              thumbnail_url: "/test-device-photo/ipad.svg",
            }),
            product({
              id: "style-c-3",
              sku: "CT-GM-0047",
              category: "game_console",
              brand: "Sony",
              model: "PlayStation 5 Slim",
              specification: "1TB · 光驱版 · 白色",
              status: "sold",
              location: "仓位 G02",
              list_price: 449,
            }),
            product({
              id: "style-c-4",
              sku: "CT-PC-0092",
              category: "computer",
              brand: "Apple",
              model: 'MacBook Air M2 13"',
              specification: "8GB / 256GB · 午夜色",
              status: "returned",
              location: "维修架 R01",
              list_price: 749,
            }),
          ],
          total: 4,
          facets: {
            brands: ["Apple", "Sony"],
            locations: ["仓位 G02", "展柜 A03", "展柜 B01", "维修架 R01"],
          },
        },
      }),
    });
  });
}

function product(overrides: Record<string, unknown>) {
  return {
    id: "style-c-product",
    sku: "CT-0000",
    category: "other",
    brand: "Chinatech",
    model: "设备",
    specification: "标准配置",
    masked_identifier: "•••• 2600",
    status: "in_stock",
    location: "展柜",
    list_price: 499,
    currency_code: "EUR",
    updated_at: "2026-08-07T10:00:00.000Z",
    ...overrides,
  };
}

async function assertGridColumns(page: Page, expected: number) {
  const shelf = page.locator('[data-inventory-product-shelf="true"]');
  await expect(shelf).toBeVisible();
  const columns = await shelf.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(columns).toBe(expected);
}

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
}
