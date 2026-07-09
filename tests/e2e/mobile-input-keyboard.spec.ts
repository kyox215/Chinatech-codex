import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260709-006-order-money-virtual-keypad";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for mobile input checks.");

test("new order mobile inputs use numeric hints and virtual money keypad", async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  const deviceSection = page.locator('[data-new-order-section="device-info"]');
  const quotationSection = page.locator('[data-new-order-section="quotation"]');

  await expect(customerSection.locator('input[inputmode="tel"]').first()).toBeVisible();
  await expect(deviceSection.locator('input[inputmode="numeric"]').first()).toBeVisible();
  await expect(quotationSection.locator('input[inputmode="decimal"]').first()).toHaveCount(0);

  await quotationSection.scrollIntoViewIfNeeded();
  const moneyTrigger = quotationSection.locator('[data-money-keypad-trigger="true"]').first();
  await expect(moneyTrigger).toBeVisible();

  await moneyTrigger.click();
  const keypad = page.locator('[data-money-keypad="true"]');
  await expect(keypad).toBeVisible();

  await keypad.locator('[data-money-keypad-key="1"]').click();
  await keypad.locator('[data-money-keypad-key="2"]').click();
  await expect(moneyTrigger).toContainText("12");

  await keypad.locator('[data-money-keypad-key="backspace"]').click();
  await expect(moneyTrigger).toContainText("1");

  await keypad.locator('[data-money-keypad-key="clear"]').click();
  await expect(moneyTrigger).toContainText("0");

  await keypad.screenshot({
    path: `${screenshotDir}/money-keypad-${testInfo.project.name}.png`,
  });
  await quotationSection.screenshot({
    path: `${screenshotDir}/new-order-money-keypad-fields-${testInfo.project.name}.png`,
  });
});
