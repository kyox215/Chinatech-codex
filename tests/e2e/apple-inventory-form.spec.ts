import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260810-003-apple-inventory-form-implementation",
);
const editableProductId = "00000000-0000-4000-8000-000000000203";
const inspectionE2eEnabled = process.env.REPAIRDESK_E2E_INVENTORY_INSPECTION === "1";

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("Apple create form exposes the shared catalog and identifier controls on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");

  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  await expect(page.locator("#product-brand")).toBeVisible();
  await expect(page.locator("#product-model")).toBeVisible();
  await page.locator("#product-brand").click();
  await expect(page.locator('[data-inventory-catalog-picker="mobile"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("INPUT");
  await page.getByRole("button", { name: "关闭品牌选择" }).click();
  await page.getByRole("radio", { name: /手机/ }).click();
  await page.getByText("更多信息", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "IMEI 2", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "EID", exact: true })).toBeVisible();
  await expect(page.getByLabel("内部备注")).toHaveAttribute("maxlength", "2000");
  await assertNoHorizontalOverflow(page);
  expect(await page.locator("input:focus, textarea:focus, select:focus").count()).toBe(0);
  await hideNextDevUi(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-create-apple.png") });
});

test("Apple edit form keeps create parity and primary identifier controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockEditableProduct(page);
  await page.goto(`/inventory/${editableProductId}/edit`);

  await expect(page.getByRole("heading", { name: /编辑 Apple iPhone 15/ })).toBeVisible();
  await expect(page.locator("#product-brand")).toBeVisible();
  await expect(page.locator("#product-model")).toBeVisible();
  await expect(page.getByRole("radio", { name: "手机" })).toBeVisible();
  await page.getByText("更多信息", { exact: true }).click();
  await expect(page.getByRole("button", { name: "主要标识" })).toBeVisible();
  await expect(page.getByText("EID 不作为主要标识")).toBeVisible();
  await expect(page.getByLabel("内部备注")).toHaveAttribute("maxlength", "2000");
  if (inspectionE2eEnabled) {
    await expect(page.locator("#product-battery-health")).toHaveValue("88");
    await expect(page.getByRole("button", { name: "正常", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({ path: resolve(screenshotDir, "390-edit-apple.png") });
});

test("Apple inspection controls stay explicit and write-ready", async ({ page }) => {
  test.skip(
    !inspectionE2eEnabled,
    "Set REPAIRDESK_E2E_INVENTORY_INSPECTION=1 for inspection UI checks.",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");
  await page.locator("#product-brand").click();
  await page.getByText("Apple", { exact: true }).last().click();
  await page.locator("#product-model").click();
  await page.getByText("iPhone 15", { exact: true }).last().click();

  const inspection = page.locator('[data-ui="inventory-product-inspection"]');
  await expect(inspection).toBeVisible();
  await inspection.locator("#product-battery-health").fill("91");
  await inspection.getByRole("button", { name: "正常", exact: true }).click();
  await expect(inspection.locator("#product-battery-health")).toHaveValue("91");
  await expect(inspection.getByRole("button", { name: "正常", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({
    path: resolve(screenshotDir, "390-inspection-apple.png"),
  });
});

test("Apple create and edit controls remain bounded on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory/new");
  await expect(page.getByRole("heading", { name: "快速录入商品" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({ path: resolve(screenshotDir, "1440-create-apple.png") });

  await mockEditableProduct(page);
  await page.goto(`/inventory/${editableProductId}/edit`);
  await expect(page.getByRole("button", { name: "保存修改" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({ path: resolve(screenshotDir, "1440-edit-apple.png") });
});

test("create and edit keep one responsive product form contract", async ({ page }) => {
  await mockEditableProduct(page);
  for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await page.goto("/inventory/new");
    await expect(page.locator("#product-brand")).toBeVisible();
    await expect(page.locator("#product-model")).toBeVisible();
    await expect(page.locator("#product-category-phone")).toBeVisible();
    await page.getByText("更多信息", { exact: true }).click();
    await expect(page.locator("#product-notes")).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto(`/inventory/${editableProductId}/edit`);
    await expect(page.locator("#product-brand")).toBeVisible();
    await expect(page.locator("#product-model")).toBeVisible();
    await expect(page.locator("#product-category-phone")).toBeVisible();
    await page.getByText("更多信息", { exact: true }).click();
    await expect(page.locator("#product-notes")).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});

test("full-page create back action protects dirty drafts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory/new");
  await page.locator("#product-brand").click();
  await page
    .locator('[data-inventory-catalog-picker="mobile"]')
    .getByRole("option")
    .filter({ hasText: "Apple" })
    .first()
    .click();
  let dismissed = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("尚未保存");
    dismissed = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "返回商品库存" }).click();
  await expect.poll(() => dismissed).toBe(true);
  await expect(page).toHaveURL(/\/inventory\/new$/);
});

test("browser back and edit cancel use the same dirty guard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inventory");
  await page.goto("/inventory/new");
  await page.locator("#product-brand").click();
  await page
    .locator('[data-inventory-catalog-picker="mobile"]')
    .getByRole("option")
    .filter({ hasText: "Apple" })
    .first()
    .click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL(/\/inventory$/);

  await mockEditableProduct(page);
  await page.goto(`/inventory/${editableProductId}/edit`);
  await page.getByText("更多信息", { exact: true }).click();
  await page.locator("#product-notes").fill("待确认的编辑");
  let cancelDismissed = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("尚未保存");
    cancelDismissed = true;
    await dialog.dismiss();
  });
  await page.getByRole("button", { name: "取消" }).click();
  await expect.poll(() => cancelDismissed).toBe(true);
  await expect(page).toHaveURL(new RegExp(`${editableProductId}/edit$`));
});

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
          category: "phone",
          brand: "Apple",
          model: "iPhone 15",
          ram_capacity: "8 GB",
          storage_capacity: "256 GB",
          color: "蓝色",
          condition: "良好",
          specifications: { network_variant: "EU" },
          identifiers: [
            { kind: "imei1", value: "490154203237518", source: "manual", primary: true },
            {
              kind: "eid",
              value: "12345678901234567890123456789012",
              source: "manual",
              primary: false,
            },
          ],
          version: 1,
          list_price: 399,
          location: "展柜 A",
          warranty_months: 12,
          notes: "",
          inspection: {
            id: "00000000-0000-0000-0000-000000000204",
            battery_health: 88,
            face_id_status: "normal",
            inspected_at: "2026-07-29T12:00:00.000Z",
          },
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

async function hideNextDevUi(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal, [data-next-badge-root] { display: none !important; }",
  });
}
