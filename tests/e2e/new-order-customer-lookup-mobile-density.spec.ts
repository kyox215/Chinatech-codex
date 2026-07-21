import { mkdirSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

const screenshotDir = "screenshots/TASK-20260710-010-customer-search-mobile-density";
const enabled =
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1" ||
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(
  !enabled,
  "Set REPAIRDESK_E2E_ORDER_AUDIT=1 for new order customer lookup density checks.",
);

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("matched customer results render as a full-width compact mobile panel", async ({
  page,
}, testInfo) => {
  mkdirSync(screenshotDir, { recursive: true });
  await mockCustomerIntakeSearch(page);

  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

  const customerSection = page.locator('[data-new-order-section="customer"]');
  await expect(customerSection).toBeVisible();

  const phoneTrigger = customerSection.locator('[data-phone-keypad-trigger="true"]').first();
  await expect(phoneTrigger).toBeVisible();
  await phoneTrigger.click();

  const phoneKeypad = page.locator('[data-phone-keypad="true"]');
  await expect(phoneKeypad).toBeVisible();
  for (const digit of ["3", "3", "3", "5", "7"]) {
    await phoneKeypad.locator(`[data-phone-keypad-key="${digit}"]`).click();
  }

  const resultsPanel = customerSection.locator('[data-customer-identity-results="true"]');
  await expect(resultsPanel).toBeVisible();
  await expect(customerSection.getByText("客户 3335719865")).toBeVisible();
  await expect(customerSection.getByText("Apple iPhone 15")).toHaveCount(0);
  await expect(customerSection.getByRole("listbox", { name: "客户匹配结果" })).toHaveCount(1);
  await expectNoPageOverflow(page);
  await expectPanelUsesMobileWidth(customerSection, resultsPanel);

  await customerSection.screenshot({
    path: `${screenshotDir}/customer-lookup-mobile-density-match-${testInfo.project.name}.png`,
  });
});

async function mockCustomerIntakeSearch(page: Page) {
  await page.route("**/api/repairdesk/customers/intake-search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            customer: {
              id: "customer-3335719865",
              name: "客户 3335719865",
              phone_e164: "3335719865",
              phone_raw: "3335719865",
              contact_phones: [],
            },
            exactMatch: true,
            phoneMatchKind: "exact_primary",
            nameMatchKind: "none",
            historyDevices: [
              {
                id: "history-iphone-15",
                device_id: "device-iphone-15",
                brand: "Apple",
                model: "iPhone 15",
                serial_or_imei: "R2027000",
                order_public_no: "R2027000",
              },
              {
                id: "history-iphone-13",
                device_id: "device-iphone-13",
                brand: "Apple",
                model: "iphone 13",
                serial_or_imei: null,
                order_public_no: null,
              },
            ],
          },
        ],
      }),
    });
  });
}

async function expectPanelUsesMobileWidth(customerSection: Locator, resultsPanel: Locator) {
  const [sectionBox, panelBox] = await Promise.all([
    customerSection.boundingBox(),
    resultsPanel.boundingBox(),
  ]);

  expect(sectionBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBeGreaterThanOrEqual(sectionBox!.width - 32);
  expect(Math.abs(panelBox!.x - sectionBox!.x)).toBeLessThanOrEqual(16);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
