import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260729-011-inventory-product-simplification-implementation",
);

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("mobile product list, filter, intake and detail stay simple and within viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  await expect(page.getByText("回收报价")).toHaveCount(0);
  await expect(page.getByText("客户确认")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-product-list.png"), fullPage: true });

  await page.getByRole("button", { name: "筛选商品" }).click();
  await expect(page.getByRole("heading", { name: "筛选商品" })).toBeVisible();
  await expect(page.getByRole("button", { name: "应用筛选" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重置" })).toBeVisible();
  await page.waitForTimeout(250);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-product-filter-sheet.png") });
  await page.keyboard.press("Escape");

  await page.goto("/inventory/new");
  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  await expect(page.getByText("三个字段即可保存")).toBeVisible();
  await expect(page.getByRole("radio", { name: /手机/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /游戏机/ })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(screenshotDir, "390-product-quick-intake.png"),
    fullPage: true,
  });

  await page.goto("/inventory/inv_mock_3");
  await expect(page.getByRole("heading", { level: 2, name: "Apple iPad Air 5" })).toBeVisible();
  await expect(page.getByText("I001203").first()).toBeVisible();
  await expect(page.getByText("回收报价")).toHaveCount(0);
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: resolve(screenshotDir, "390-product-minimal-detail.png"),
    fullPage: true,
  });
});

test("desktop product list uses a bounded six-column layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory");
  await expect(page.getByText("SKU / 状态")).toBeVisible();
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "1280-product-list.png"), fullPage: true });
});

for (const viewport of [
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 834, height: 1194 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`product list, intake and detail fit at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.goto("/inventory");
    await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
    await page.getByRole("button", { name: "筛选商品" }).click();
    await expect(page.getByRole("heading", { name: "筛选商品" })).toBeVisible();
    await expect(page.getByRole("button", { name: "应用筛选" })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await assertNoHorizontalOverflow(page);

    await page.goto("/inventory/new");
    await expect(page.getByRole("radio", { name: /手机/ })).toBeVisible();
    await expect(page.getByLabel("品牌")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/inventory/inv_mock_3");
    await expect(page.getByRole("heading", { level: 2, name: "Apple iPad Air 5" })).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
  });
}

test("quick intake keeps failed drafts and preserves same-product fields after save-and-continue", async ({
  page,
}) => {
  await page.route("**/api/repairdesk/inventory/products/quick-create", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ok: true,
          code: "created",
          id: "00000000-0000-4000-8000-000000000099",
          sku: "I009999",
          created_at: "2026-07-29T14:00:00.000Z",
        },
      }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");
  await page.getByLabel("品牌").fill("Synthetic Brand");
  await page.getByLabel("型号 / 商品名称").fill("Synthetic Console");
  await page.getByText("更多信息", { exact: true }).click();
  await page.getByLabel("计划售价").fill("12.345");
  await page.getByRole("button", { name: "保存并继续录入" }).click();
  await expect(page.locator("#product-form-error")).toContainText("计划售价格式无效");
  await expect(page.getByLabel("品牌")).toHaveValue("Synthetic Brand");
  await expect(page.getByLabel("计划售价")).toBeFocused();

  await page.getByLabel("计划售价").fill("129,90");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "保存并继续录入" }).click();
  await expect(page.locator("#product-form-error")).toContainText("当前离线");
  await expect(page.getByLabel("品牌")).toHaveValue("Synthetic Brand");
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "保存并继续录入" }).click();
  await expect(page.getByText(/商品 I\d+ 已录入/)).toBeVisible();
  await expect(page.getByLabel("品牌")).toHaveValue("Synthetic Brand");
  await expect(page.getByLabel("型号 / 商品名称")).toHaveValue("Synthetic Console");
  await expect(page.getByLabel("计划售价")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /手机/ })).toHaveAttribute("aria-checked", "true");
});

test("product list and detail expose recoverable empty and error states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");
  await page
    .locator('input[placeholder="搜索商品、SKU、型号"]:visible')
    .fill("definitely-no-product");
  await expect(page.getByRole("heading", { name: "没有符合条件的商品" })).toBeVisible();

  await page.route("**/api/repairdesk/inventory/products/get", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "controlled product detail failure" }),
    });
  });
  await page.goto("/inventory/inv_mock_3");
  await expect(page.getByRole("heading", { name: "商品详情加载失败" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
});

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("header, main, section, form, [role='dialog']")]
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
