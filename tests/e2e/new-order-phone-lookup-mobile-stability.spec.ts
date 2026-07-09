import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260709-012-phone-lookup-mobile-stability";
const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for new order phone lookup checks.");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("new order phone lookup stays anchored after the first mobile digit", async ({
  page,
}, testInfo) => {
  mkdirSync(screenshotDir, { recursive: true });

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  await expect(customerSection).toBeVisible();

  await expect(customerSection.locator('input[inputmode="tel"]').first()).toHaveCount(0);
  const phoneTrigger = customerSection.locator('[data-phone-keypad-trigger="true"]').first();
  await expect(phoneTrigger).toBeVisible();

  const beforeBox = await phoneTrigger.boundingBox();
  expect(beforeBox).not.toBeNull();

  await phoneTrigger.click();
  const phoneKeypad = page.locator('[data-phone-keypad="true"]');
  await expect(phoneKeypad).toBeVisible();
  await phoneKeypad.locator('[data-phone-keypad-key="3"]').click();
  await page.waitForTimeout(220);

  await expect(page.getByRole("listbox", { name: "客户电话搜索结果" })).toHaveCount(0);

  const afterFirstDigitBox = await phoneTrigger.boundingBox();
  expect(afterFirstDigitBox).not.toBeNull();
  expect(Math.abs((afterFirstDigitBox?.y ?? 0) - (beforeBox?.y ?? 0))).toBeLessThanOrEqual(1);

  await customerSection.screenshot({
    path: `${screenshotDir}/phone-lookup-first-digit-stable-${testInfo.project.name}.png`,
  });

  await phoneKeypad.locator('[data-phone-keypad-key="4"]').click();
  await phoneKeypad.locator('[data-phone-keypad-key="5"]').click();
  await expect(page.getByRole("listbox", { name: "客户电话搜索结果" })).toBeVisible();
  await expectNoPageOverflow(page);

  await page.screenshot({
    path: `${screenshotDir}/phone-lookup-three-digits-popover-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
