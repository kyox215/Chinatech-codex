import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260730-002-inventory-device-data-implementation",
);
const editableProductId = "00000000-0000-4000-8000-000000000203";

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("mobile intake keeps device data easy to scan and inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");

  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  const brandTrigger = page.locator("#product-brand");
  await expect(brandTrigger).toHaveAttribute("role", "combobox");
  await expect(brandTrigger).toHaveJSProperty("tagName", "BUTTON");
  await brandTrigger.click();
  await expect(page.locator('[data-inventory-catalog-picker="mobile"]')).toBeVisible();
  await expect(page.locator("[data-inventory-catalog-search]")).toHaveCount(0);
  await page.locator("[data-inventory-catalog-search-action]").click();
  await expect(page.getByPlaceholder("搜索手机品牌或手动输入")).toBeFocused();
  await page.getByRole("button", { name: "关闭品牌选择" }).click();
  await expect(page.getByRole("textbox", { name: "IMEI 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "摄像头扫码录入 IMEI 1" })).toBeVisible();
  await page.getByText("更多信息", { exact: true }).click();
  await expect(page.getByLabel("内存（RAM）")).toBeVisible();
  await expect(page.getByLabel("存储容量")).toBeVisible();
  await expect(page.getByLabel("设备颜色")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "IMEI 2", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "EID", exact: true })).toBeVisible();
  await expect(page.getByLabel("EAN / GTIN")).toBeVisible();
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(screenshotDir, "390-device-intake.png") });

  await page.getByRole("radio", { name: /电脑/ }).click();
  await expect(page.getByRole("textbox", { name: "序列号", exact: true })).toBeVisible();
  await expect(page.getByLabel("硬盘 / 存储容量")).toBeVisible();
  await expect(page.getByLabel("处理器")).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("mobile detail stays minimal and edit supports full device data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/inv_mock_3");

  await expect(page.getByRole("heading", { level: 2, name: "Apple iPad Air 5" })).toBeVisible();
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "编辑商品" })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-device-detail.png"), fullPage: true });

  await mockEditableProduct(page);
  await page.goto(`/inventory/${editableProductId}/edit`);
  await expect(page.getByRole("heading", { name: /编辑 Apple iPad Air 5/ })).toBeVisible();
  // Compact/mobile catalog controls are buttons by design so opening them does
  // not summon the system keyboard. Assert the selected label rather than an
  // input value; desktop keeps the editable input contract.
  await expect(page.locator("#product-brand")).toContainText("Apple");
  await expect(page.getByText("设备标识", { exact: true })).toBeVisible();
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-device-edit.png"), fullPage: true });
});

test("desktop edit remains bounded without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockEditableProduct(page);
  await page.goto(`/inventory/${editableProductId}/edit`);

  await expect(page.getByRole("heading", { name: /编辑 Apple iPad Air 5/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存修改" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: resolve(screenshotDir, "1440-device-edit.png"), fullPage: true });
});

for (const viewport of [
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
]) {
  test(`intake, detail and edit remain usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.goto("/inventory/new");
    await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
    await expect(page.getByLabel("存储容量")).toBeVisible();
    await expect(page.getByLabel("设备颜色")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/inventory/inv_mock_3");
    await expect(page.getByRole("heading", { level: 2, name: "Apple iPad Air 5" })).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    await mockEditableProduct(page);
    await page.goto(`/inventory/${editableProductId}/edit`);
    await expect(page.getByRole("button", { name: "保存修改" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "序列号", exact: true })).toHaveValue(
      "DMP000000003",
    );
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${viewport.width}-device-edit.png`),
      fullPage: true,
    });
  });
}

async function mockEditableProduct(page: Page) {
  await page.route("**/api/repairdesk/inventory/products/edit-data", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: editableProductId,
          sku: "I001203",
          status: "in_stock",
          category: "tablet",
          brand: "Apple",
          model: "iPad Air 5",
          ram_capacity: "8 GB",
          storage_capacity: "64 GB",
          color: "Blue",
          condition: "good",
          gtin: "0194252790693",
          specifications: { connectivity: "Wi-Fi" },
          identifiers: [
            {
              kind: "serial",
              value: "DMP000000003",
              source: "manual",
              primary: true,
            },
          ],
          version: 1,
          list_price: 399,
          list_price_provided: true,
          cost_amount: 240,
          cost_provided: true,
          location: "展柜 A",
          warranty_months: 12,
          warranty_provided: true,
          notes: "",
          created_at: "2026-07-29T12:00:00.000Z",
          updated_at: "2026-07-29T12:00:00.000Z",
        },
      }),
    });
  });
}

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
