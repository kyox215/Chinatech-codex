import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260731-003-inventory-product-mobile-density",
);
const productId = "00000000-0000-4000-8000-000000000731";

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("390px list shows six complete dense cards in the first viewport", async ({
  page,
  browserName,
}) => {
  await mockProductList(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");

  const cards = page.locator('[data-ui="inventory-product-card"]');
  await expect(cards).toHaveCount(8);
  const cardBox = await cards.first().boundingBox();
  const sixthBox = await cards.nth(5).boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.height).toBeGreaterThanOrEqual(84);
  expect(cardBox!.height).toBeLessThanOrEqual(88);
  expect(sixthBox).not.toBeNull();
  expect(sixthBox!.y + sixthBox!.height).toBeLessThanOrEqual(844);
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);

  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-390-product-list-dense.png`),
  });
});

test("mobile intake keeps five categories and both save actions immediately reachable", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");

  const categories = page.getByRole("radio");
  await expect(categories).toHaveCount(5);
  const undersizedCategories = await categories.evaluateAll((nodes) =>
    nodes
      .map((node) => node.getBoundingClientRect().toJSON())
      .filter((rect) => rect.width < 44 || rect.height < 44),
  );
  expect(undersizedCategories).toEqual([]);
  await expect(page.getByRole("button", { name: "保存并继续录入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存并查看商品" })).toBeVisible();
  await assertActionBarCentered(page, 390);
  expect(
    await page.getByLabel("品牌").evaluate((input) => parseFloat(getComputedStyle(input).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);

  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-390-product-intake-core.png`),
  });
});

test("430px detail fits the standard workbench without repeating the primary identifier", async ({
  page,
  browserName,
}) => {
  await mockProductDetail(page);
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto(`/inventory/${productId}`);

  await expect(page.getByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" })).toBeVisible();
  await expect(page.getByText("6 项资料")).toBeVisible();
  await expect(page.getByText("•••• 4321")).toHaveCount(1);
  await expect(page.getByText("配件齐全，已存入防尘收纳盒。")).toBeVisible();
  const notes = await page.getByText("配件齐全，已存入防尘收纳盒。").boundingBox();
  expect(notes).not.toBeNull();
  expect(notes!.y + notes!.height).toBeLessThanOrEqual(932);
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);

  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-430-product-detail-dense.png`),
  });
});

test("390px edit exposes field-level validation and a fixed save bar", async ({
  page,
  browserName,
}) => {
  await mockProductEdit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/inventory/${productId}/edit`);

  await expect(page.getByLabel("品牌")).toHaveValue("Apple");
  const actions = page.locator('[data-ui="inventory-product-actions"]');
  await expect(actions).toBeVisible();
  const actionBox = await actions.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(844);
  await assertActionBarCentered(page, 390);

  await page.getByLabel("品牌").fill("");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByLabel("品牌")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#edit-brand-error")).toHaveText("请填写品牌");
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);

  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-390-product-edit-validation.png`),
  });
});

test("desktop list remains a bounded six-column table", async ({ page, browserName }) => {
  await mockProductList(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/inventory");

  await expect(page.getByText("SKU / 状态")).toBeVisible();
  await expect(page.locator('[data-ui="inventory-product-card"]').first()).toBeHidden();
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-1024-product-list-dense.png`),
  });
});

async function mockProductList(page: Page) {
  const categories = ["phone", "tablet", "computer", "game_console", "other"] as const;
  const items = Array.from({ length: 8 }, (_, index) => ({
    id: `${productId.slice(0, -1)}${index + 1}`,
    sku: `I0073${index + 1}`,
    category: categories[index % categories.length],
    brand: ["Apple", "Samsung", "Lenovo", "Sony"][index % 4],
    model: ["iPhone 15 Pro", "Galaxy S24", "ThinkPad X1", "PlayStation 5"][index % 4],
    specification: index % 2 ? "256 GB · 8 GB" : "128 GB · 蓝色",
    masked_identifier: `•••• ${7300 + index}`,
    status: index === 2 ? "reserved" : "in_stock",
    location: `A-${index + 1}`,
    list_price: 399 + index * 50,
    currency_code: "EUR",
    updated_at: "2026-07-31T08:00:00.000Z",
  }));
  await page.route("**/api/repairdesk/inventory/products/list", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items,
          total: items.length,
          facets: { brands: ["Apple", "Lenovo", "Samsung", "Sony"], locations: [] },
        },
      }),
    });
  });
}

async function mockProductDetail(page: Page) {
  await page.route("**/api/repairdesk/inventory/products/get", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: productDetail() }),
    });
  });
}

async function mockProductEdit(page: Page) {
  await page.route("**/api/repairdesk/inventory/products/edit-data", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...productDetail(), identifiers: [] } }),
    });
  });
}

function productDetail() {
  return {
    id: productId,
    sku: "I007301",
    category: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro",
    specification: "256 GB · Natural Titanium",
    masked_identifier: "•••• 4321",
    status: "in_stock",
    location: "展柜 A",
    list_price: 899,
    currency_code: "EUR",
    updated_at: "2026-07-31T08:00:00.000Z",
    color: "Natural Titanium",
    ram_capacity: "8 GB",
    storage_capacity: "256 GB",
    gtin: "0195949012345",
    condition: "A",
    specifications: { network_variant: "EU 双卡" },
    identifiers: [
      { kind: "imei1", masked_value: "•••• 4321", primary: true },
      { kind: "serial", masked_value: "•••• AB9C", primary: false },
    ],
    cost_amount: 610,
    warranty_months: 12,
    notes: "配件齐全，已存入防尘收纳盒。",
    created_at: "2026-07-29T08:00:00.000Z",
    version: 2,
  };
}

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport);
}

async function assertActionBarCentered(page: Page, viewportWidth: number) {
  const box = await page.locator('[data-ui="inventory-product-actions"]').boundingBox();
  expect(box).not.toBeNull();
  const rightInset = viewportWidth - (box!.x + box!.width);
  expect(Math.abs(box!.x - rightInset)).toBeLessThanOrEqual(1);
  expect(box!.x).toBeGreaterThanOrEqual(8);
}

async function hideNextDevUi(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}
