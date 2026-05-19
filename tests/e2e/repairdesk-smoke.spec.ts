import { expect, test } from "@playwright/test";

test("orders list and new order routes load", async ({ page }) => {
  await page.goto("/orders");
  await expect(page.getByText("工单").first()).toBeVisible();

  await page.goto("/orders/new");
  await expect(page.getByText("新建维修订单").first()).toBeVisible();
});

test("customers route loads", async ({ page }) => {
  await page.goto("/customers");
  await expect(page.getByText("客户").first()).toBeVisible();
});
