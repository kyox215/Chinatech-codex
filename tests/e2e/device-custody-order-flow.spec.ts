import { expect, test } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for custody flow checks.");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("new order requires an explicit custody choice and customer-held devices keep unlock UI", async ({
  page,
}) => {
  await page.goto("/orders/new");
  await page.waitForLoadState("networkidle");
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('[data-new-order-form="true"]')).toBeVisible();

  const withShop = page.getByRole("button", { name: /设备留店/ });
  const withCustomer = page.getByRole("button", { name: /设备未留店/ });
  await expect(withShop).toHaveAttribute("aria-pressed", "false");
  await expect(withCustomer).toHaveAttribute("aria-pressed", "false");

  await expect(page.getByText("系统不会替你默认选择")).toBeVisible();

  await withShop.click();
  await expect(withShop).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-device-unlock-method="pin"]').click();
  const pinTrigger = page.getByRole("button", { name: "数字 PIN" });
  await pinTrigger.click();
  for (const digit of ["0", "0", "1", "2"]) {
    await page.locator(`[data-device-unlock-pin-digit="${digit}"]`).click();
  }
  await page.locator('[data-device-unlock-pin-done="true"]').click();
  await expect(pinTrigger).toContainText("0012");

  await withCustomer.click();
  await expect(withCustomer).toHaveAttribute("aria-pressed", "true");
  await expect(withShop).toHaveAttribute("aria-pressed", "false");
  await expect(pinTrigger).toContainText("0012");
  await expect(page.getByText("设备未留店也可登记，后续交还不会自动清除")).toBeVisible();
  await expect(
    page
      .locator('[data-new-order-offline-status="true"]:visible')
      .getByText(/PIN 或图案不会进入本机草稿/),
  ).toBeVisible();

  await withShop.click();
  await expect(withShop).toHaveAttribute("aria-pressed", "true");
  await expect(pinTrigger).toContainText("0012");
  await expectNoHorizontalOverflow(page);
});

test("mobile detail keeps the receive action below the sticky header", async ({ page }) => {
  await page.goto("/orders/ord_1");
  await page.waitForLoadState("networkidle");

  const header = page.locator('[data-mobile-order-header="true"]');
  const card = page.locator('[data-order-device-custody="true"]').filter({ visible: true }).first();
  await expect(header).toBeVisible();
  await expect(card).toBeVisible();
  await expect(card.getByText("客户持有")).toBeVisible();
  await expect(card.getByRole("button", { name: "确认收机" })).toBeVisible();
  const unlockButton = page.getByRole("button", { name: "密码", exact: true });
  await expect(unlockButton).toBeVisible();
  await unlockButton.click();
  await expect(page.getByRole("heading", { name: "编辑手机密码" })).toBeVisible();
  await expect(page.getByText(/默认只在详情里遮挡查看/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("001258");
  await page.getByRole("button", { name: "取消", exact: true }).click();

  const headerBox = await header.boundingBox();
  const cardBox = await card.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  await expectNoHorizontalOverflow(page);
});

test("cancelled customer-held orders never request a device return", async ({ page }) => {
  await page.goto("/orders/ord_15");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("已取消").first()).toBeVisible();
  await expect(
    page.locator('[data-order-device-custody="true"]:visible').getByText("客户持有"),
  ).toBeVisible();
  await expect(page.getByText("设备退还尚未确认")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
