import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260810-006-inventory-product-detail-redesign",
);
const productId = "00000000-0000-4000-8000-000000000501";
const rawImei = "356789012344321";

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("complete device profile stays readable, private and bounded across viewports", async ({
  page,
  browserName,
}) => {
  await mockProductDetail(page, richProduct());

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/inventory/${productId}`);

    await expect(
      page.getByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "设备工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "设备身份" })).toBeVisible();
    await expect(page.getByText("5 项核心资料")).toBeVisible();
    await expect(page.getByRole("heading", { name: "设备检测" })).toBeVisible();
    await expect(page.getByText("电池健康", { exact: true })).toBeVisible();
    await expect(page.getByText("Face ID", { exact: true })).toBeVisible();
    await expect(page.getByText("91%", { exact: true })).toBeVisible();
    await expect(page.getByText("正常", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^检测时间：/)).toBeVisible();
    await expect(page.getByText("经营信息", { exact: true })).toBeVisible();
    await expect(page.getByText("•••• 4321").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑商品" }).first()).toBeVisible();
    await expect(page.getByText(rawImei)).toHaveCount(0);
    await expect(page.getByText("激活锁", { exact: true })).toHaveCount(0);
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    if (viewport.width < 1024) {
      await assertTouchTargets(page);
      await assertHeaderDoesNotCoverHero(page);
    }

    await hideDevBadge(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${viewport.width}-${browserName}-complete-device-profile.png`),
      fullPage: true,
    });
  }
});

test("redacted cost and sparse data stay explicit without fake values", async ({ page }) => {
  await mockProductDetail(
    page,
    richProduct({
      cost_amount: undefined,
      finance_redacted: true,
      condition: undefined,
      storage_capacity: undefined,
      ram_capacity: undefined,
      color: undefined,
      list_price: undefined,
      location: undefined,
      warranty_months: undefined,
      specifications: {},
      identifiers: [],
      masked_identifier: "•••• 7788",
      gtin: undefined,
      notes: undefined,
      inspection: undefined,
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/inventory/${productId}`);

  await expect(page.getByRole("heading", { level: 2, name: "Apple iPhone 15 Pro" })).toBeVisible();
  await expect(page.getByText("成本", { exact: true })).toHaveCount(0);
  await expect(page.getByText("成色", { exact: true })).toBeVisible();
  await expect(page.getByText("保修", { exact: true })).toBeVisible();
  await expect(page.getByText("未录入", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("未定价", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("未设置库位", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("5 项核心资料")).toBeVisible();
  await expect(
    page.getByText("暂无备注。编辑商品时可补充检测结果、配件或售后说明。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "设备检测" })).toBeVisible();
  await expect(page.getByText("未检测", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("检测时间：未检测", { exact: true })).toBeVisible();
  await expect(page.getByText("•••• 7788")).toHaveCount(1);
  await assertNoHorizontalOverflow(page);
  await hideDevBadge(page);
  await page.screenshot({
    path: resolve(screenshotDir, `390-${test.info().project.name}-sparse-device-profile.png`),
    fullPage: true,
  });
});

async function mockProductDetail(page: Page, detail: ReturnType<typeof richProduct>) {
  await page.route("**/api/repairdesk/inventory/products/get", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: detail }),
    });
  });
}

async function hideDevBadge(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll("nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button]")
      .forEach((element) => element.remove());
  });
}

function richProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: productId,
    sku: "I001501",
    category: "phone",
    brand: "Apple",
    model: "iPhone 15 Pro",
    masked_identifier: "•••• 9999",
    status: "in_stock",
    location: "展柜 A · 玻璃门内侧",
    list_price: 899,
    currency_code: "EUR",
    updated_at: "2026-07-30T08:00:00.000Z",
    color: "Natural Titanium",
    ram_capacity: "8 GB",
    storage_capacity: "256 GB",
    gtin: "0195949012345",
    condition: "A",
    specifications: { network_variant: "EU 双卡" },
    identifiers: [
      { kind: "imei1", masked_value: `•••• ${rawImei.slice(-4)}`, primary: true },
      { kind: "serial", masked_value: "•••• AB9C", primary: false },
    ],
    cost_amount: 610,
    warranty_months: 12,
    notes: "配件齐全，已存入防尘收纳盒。",
    inspection: {
      id: "inspection-1",
      battery_health: 91,
      face_id_status: "normal",
      inspected_at: "2026-07-29T08:00:00.000Z",
    },
    created_at: "2026-07-29T08:00:00.000Z",
    version: 2,
    ...overrides,
  };
}

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("header, main, section")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))
      .slice(0, 10),
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
  expect(result.offenders).toEqual([]);
}

async function assertTouchTargets(page: Page) {
  const undersized = await page
    .locator('[data-ui="inventory-product-detail-workbench"] button:visible')
    .evaluateAll((buttons) =>
      buttons
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            label: button.getAttribute("aria-label") ?? button.textContent,
            ...rect.toJSON(),
          };
        })
        .filter((rect) => rect.width < 44 || rect.height < 44),
    );
  expect(undersized).toEqual([]);
}

async function assertHeaderDoesNotCoverHero(page: Page) {
  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(
      '[data-ui="inventory-product-mobile-header"] > section',
    );
    const hero = document.querySelector<HTMLElement>('[data-ui="inventory-product-hero"]');
    if (!header || !hero) return null;
    const headerRect = header.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    return { headerBottom: headerRect.bottom, heroTop: heroRect.top };
  });
  expect(geometry).not.toBeNull();
  expect(geometry!.heroTop).toBeGreaterThanOrEqual(geometry!.headerBottom + 6);
  expect(geometry!.heroTop).toBeLessThanOrEqual(geometry!.headerBottom + 10);
}
