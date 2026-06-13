import { expect, test, type Page } from "@playwright/test";

async function expectProtectedRoute(page: Page, text: string) {
  await expect(
    page.getByText(text).or(page.getByRole("heading", { name: "RepairDesk 登录" })),
  ).toBeVisible();
}

test("orders list and new order routes load", async ({ page }) => {
  await page.goto("/orders");
  await expectProtectedRoute(page, "工单");

  await page.goto("/orders/new");
  await expectProtectedRoute(page, "新建维修订单");
});

test("customers route loads", async ({ page }) => {
  await page.goto("/customers");
  await expectProtectedRoute(page, "客户");
});

test("buyback route loads", async ({ page }) => {
  await page.goto("/buyback");
  await expectProtectedRoute(page, "回收管理");
});

test("inventory route loads", async ({ page }) => {
  await page.goto("/inventory");
  await expectProtectedRoute(page, "配件与库存");
});
