import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const screenshotDir = "screenshots/TASK-20260709-005-mobile-numeric-keyboards";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for mobile input keyboard checks.");

test("new order mobile inputs expose numeric keyboard hints", async ({ page }, testInfo) => {
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
  await expect(quotationSection.locator('input[inputmode="decimal"]').first()).toBeVisible();

  await quotationSection.scrollIntoViewIfNeeded();
  await quotationSection.screenshot({
    path: `${screenshotDir}/new-order-mobile-keyboard-fields-${testInfo.project.name}.png`,
  });
});
