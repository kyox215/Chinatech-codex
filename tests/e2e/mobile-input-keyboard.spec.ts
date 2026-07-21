import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260709-009-customer-phone-name-keypad";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for mobile input checks.");

test("new order mobile inputs use virtual phone and money keypads", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  mkdirSync(screenshotDir, { recursive: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  const deviceSection = page.locator('[data-new-order-section="device-info"]');
  const quotationSection = page.locator('[data-new-order-section="quotation"]');

  await expect(customerSection.locator('input[inputmode="tel"]').first()).toBeHidden();
  const phoneTrigger = customerSection.locator('[data-phone-keypad-trigger="true"]').first();
  await expect(phoneTrigger).toBeVisible();

  await phoneTrigger.click();
  const phoneKeypad = page.locator('[data-phone-keypad="true"]');
  await expect(phoneKeypad).toBeVisible();
  const phoneDock = page.locator('[data-virtual-keyboard-dock="true"]').filter({
    has: phoneKeypad,
  });
  await expect(phoneDock).toBeVisible();
  await expect(phoneDock).toHaveCSS("position", "fixed");
  const phoneDockBox = await phoneDock.boundingBox();
  expect(phoneDockBox?.y ?? 0).toBeGreaterThan(page.viewportSize()!.height * 0.45);

  await phoneKeypad.locator('[data-phone-keypad-key="+39"]').click();
  await phoneKeypad.locator('[data-phone-keypad-key="3"]').click();
  await phoneKeypad.locator('[data-phone-keypad-key="3"]').click();
  await phoneKeypad.locator('[data-phone-keypad-key="3"]').click();
  await expect(phoneTrigger).toContainText("+39333");
  await expect(customerSection.locator('[data-customer-identity-results="true"]')).toBeVisible();

  await phoneKeypad.screenshot({
    path: `${screenshotDir}/phone-keypad-${testInfo.project.name}.png`,
  });
  await customerSection.screenshot({
    path: `${screenshotDir}/new-order-customer-phone-results-${testInfo.project.name}.png`,
  });
  await phoneKeypad.locator('[data-phone-keypad-done="true"]').click();

  const nameInput = customerSection.locator('input[placeholder="搜索客户姓名（可选）"]').first();
  await expect(nameInput).toBeVisible();
  await nameInput.fill("12");
  await expect(page.getByRole("listbox", { name: "客户匹配结果" })).toHaveCount(1);
  await expect(customerSection.getByText(/姓名仅排序同号结果/)).toBeVisible();

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
