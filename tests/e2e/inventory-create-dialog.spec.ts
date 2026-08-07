import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260807-006-inventory-create-dialog-implementation",
);

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
]) {
  test(`inventory create stays in one bounded dialog at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/inventory");
    await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
    const pathnameBefore = new URL(page.url()).pathname;

    await page.getByRole("button", { name: "快速录入商品" }).click();
    const dialog = page.locator('[data-inventory-product-create-dialog="true"]');
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel(/品牌/)).toBeFocused();
    expect(new URL(page.url()).pathname).toBe(pathnameBefore);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toHaveCount(0);
    await expect(page.locator('[data-ui="inventory-product-actions"]')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertDialogInsideViewport(page);

    if (viewport.width === 390 || viewport.width === 1280) {
      await page.screenshot({
        path: resolve(screenshotDir, `${viewport.width}-inventory-create-dialog.png`),
      });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/inventory");
  });
}

test("dirty close uses an inline confirmation and keeps the list context", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  const search = page.locator('input[placeholder="搜索商品、SKU、型号"]:visible');
  await search.fill("Apple");
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await page.getByLabel(/品牌/).fill("Apple");
  await page.getByRole("button", { name: "关闭商品录入弹窗" }).click();

  await expect(page.getByRole("heading", { name: "放弃本次未保存商品？" })).toBeVisible();
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  const continueEditing = page.getByRole("button", { name: "继续填写" });
  const discardAndClose = page.getByRole("button", { name: "放弃并关闭" });
  await expect(continueEditing).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(discardAndClose).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(continueEditing).toBeFocused();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "430-inventory-create-discard.png") });

  await continueEditing.click();
  await expect(page.getByLabel(/品牌/)).toHaveValue("Apple");
  await page.keyboard.press("Escape");
  await discardAndClose.click();
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await expect(search).toHaveValue("Apple");
  expect(new URL(page.url()).pathname).toBe("/inventory");
});

test("route intent opens the dialog while the standalone compatibility page keeps scanning", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory?workspace=new-product");
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/inventory$/);

  await page.goto("/inventory/new");
  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toBeVisible();
  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test("successful create closes the dialog before canonical product navigation", async ({
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
          id: "inv_mock_3",
          sku: "I001203",
          created_at: "2026-08-07T16:00:00.000Z",
        },
      }),
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory");
  await expect(page.getByRole("link", { name: /Apple iPad Air 5/ })).toBeVisible();
  await page.getByRole("button", { name: "快速录入商品" }).click();
  await page.getByLabel(/品牌/).fill("Apple");
  await page.getByLabel(/型号 \/ 商品名称/).fill("iPad Air 5");
  await page.getByRole("button", { name: "保存并查看商品" }).click();

  await expect(page.locator('[data-inventory-product-create-dialog="true"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/inventory\/inv_mock_3$/);
});

async function assertNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("[role='dialog'], form, header, section")]
      .filter((element) => {
        const overflowX = window.getComputedStyle(element).overflowX;
        return (
          element.scrollWidth > element.clientWidth + 1 &&
          overflowX !== "hidden" &&
          overflowX !== "clip"
        );
      })
      .map((element) => ({
        tag: element.tagName,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
  }));
  expect(result.document).toBeLessThanOrEqual(result.viewport);
  expect(result.offenders).toEqual([]);
}

async function assertDialogInsideViewport(page: Page) {
  const dialog = page.locator('[data-inventory-product-create-dialog="true"]');
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(box!.y + box!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
}
