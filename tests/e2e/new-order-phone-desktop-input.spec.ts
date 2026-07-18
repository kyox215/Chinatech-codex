import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const screenshotDir = "screenshots/TASK-20260718-003-safari-phone-input-fix";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for desktop phone input checks.");

test.use({ viewport: { width: 1440, height: 900 } });

test("desktop phone lookup uses the native input without the virtual keypad", async ({
  page,
}, testInfo) => {
  mkdirSync(screenshotDir, { recursive: true });

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  const nativeInput = customerSection.locator('[data-phone-native-input="true"]').first();
  const keypadTrigger = customerSection.locator('[data-phone-keypad-trigger="true"]').first();

  await expect(nativeInput).toBeVisible();
  await expect(keypadTrigger).toBeHidden();

  await nativeInput.click();
  await expect(nativeInput).toBeFocused();
  await page.keyboard.type("+39333");

  await expect(nativeInput).toHaveValue("+39333");
  await expect(nativeInput).toBeFocused();
  await expect(page.locator('[data-virtual-keyboard-dock="true"]')).toHaveCount(0);

  await customerSection.screenshot({
    path: `${screenshotDir}/phone-desktop-native-input-${testInfo.project.name}.png`,
  });
});

test("tablet phone lookup keeps the fixed virtual keypad", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1023, height: 768 });
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  const nativeInput = customerSection.locator('[data-phone-native-input="true"]').first();
  const keypadTrigger = customerSection.locator('[data-phone-keypad-trigger="true"]').first();

  await expect(nativeInput).toBeHidden();
  await expect(keypadTrigger).toBeVisible();
  await keypadTrigger.click();

  const phoneKeypad = page.locator('[data-phone-keypad="true"]');
  const phoneDock = page.locator('[data-virtual-keyboard-dock="true"]').filter({
    has: phoneKeypad,
  });
  await expect(phoneKeypad).toBeVisible();
  await expect(phoneDock).toHaveCSS("position", "fixed");

  await phoneKeypad.locator('[data-phone-keypad-key="3"]').click();
  await expect(keypadTrigger).toContainText("3");

  await page.screenshot({
    path: `${screenshotDir}/phone-tablet-virtual-keypad-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
