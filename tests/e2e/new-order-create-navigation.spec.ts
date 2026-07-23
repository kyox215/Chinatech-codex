import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const screenshotDir = "screenshots/TASK-20260721-005-new-order-blank-name-safari-transition";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for order creation navigation checks.");

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

test("direct new-order page opens the canonical order detail after creation", async ({ page }) => {
  await stubSuccessfulOrderCreation(page, "ord_1");
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await completeRequiredOrderFields(page, "3457000101");
  await page.getByRole("button", { name: "创建工单" }).click();

  await expect(page).toHaveURL(/\/orders\/ord_1$/);
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
  await expect(page.locator('[data-new-order-root="true"]')).toHaveCount(0);

  const flowButton = page
    .locator('[data-order-action-dock="true"]')
    .getByRole("button", { name: "流转" });
  await expect(flowButton).toBeEnabled();
  await flowButton.click();
  const transitionPanel = page.locator('[data-order-desktop-transition-panel="true"]');
  await expect(transitionPanel).toBeVisible();
  await transitionPanel.scrollIntoViewIfNeeded();

  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: `${screenshotDir}/safari-created-order-transition-ready.png`,
    fullPage: false,
  });
});

test("order-list dialog continues in the canonical order workspace after creation", async ({
  page,
}) => {
  mkdirSync(screenshotDir, { recursive: true });
  await stubSuccessfulOrderCreation(page, "ord_1");

  await page.goto("/orders");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  await page.locator('[data-order-list-new-button="true"]').click();
  await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();

  await completeRequiredOrderFields(page, "3457000102");
  await page.getByRole("button", { name: "创建工单" }).click();

  await expect(page).toHaveURL(/\/orders\?workspace=order-detail&orderId=ord_1&source=orders$/);
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
  await expect(page.locator('[data-new-order-root="true"]')).toHaveCount(0);
  await expect(page.locator('[data-order-detail-dialog-shell="true"]')).toBeVisible();

  await page.screenshot({
    path: `${screenshotDir}/order-create-navigation-detail-desktop.png`,
    fullPage: false,
  });
});

async function completeRequiredOrderFields(page: Page, phone: string) {
  const form = page.locator('[data-new-order-form="true"]');
  await expect(form).toBeVisible();

  await form.getByRole("combobox", { name: "客户电话号码", exact: true }).fill(phone);
  await form.getByRole("button", { name: /设备留店/ }).click();
  await form.getByPlaceholder("选择品牌").fill("Apple");
  await form.getByPlaceholder("例如 iPhone 13").fill("iPhone 13");

  await expect(form.getByRole("button", { name: "创建工单" })).toBeEnabled();
}

async function stubSuccessfulOrderCreation(page: Page, id: string) {
  await page.route("**/api/repairdesk/orders/create", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { id } }),
    });
  });
}
