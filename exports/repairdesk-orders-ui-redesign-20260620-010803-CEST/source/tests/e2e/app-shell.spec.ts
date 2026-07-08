import { expect, test } from "@playwright/test";

async function skipIfProtectedRoute(page: import("@playwright/test").Page) {
  const isLogin = await page.getByRole("heading", { name: "RepairDesk 登录" }).isVisible();
  test.skip(
    isLogin,
    "protected route redirected to login; app shell is hidden until authenticated",
  );
}

test("mobile shell uses drawer navigation and one global quick action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback");
  await page.waitForLoadState("networkidle");
  await skipIfProtectedRoute(page);

  await expect(page.getByRole("button", { name: "打开快捷操作" })).toHaveCount(1);

  const bottomNavCount = await page.locator("nav").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const style = window.getComputedStyle(node);
        return style.position === "fixed" && style.bottom !== "auto";
      }).length,
  );
  expect(bottomNavCount).toBe(0);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeVisible();
  await expect(page.getByRole("link", { name: /订单管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /客户管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /回收管理/ })).toBeVisible();
});

test("desktop sidebar lines and collapsed icon size stay stable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/orders");
  await page.waitForLoadState("networkidle");
  await skipIfProtectedRoute(page);

  const topbarBox = await page.locator("header").first().boundingBox();
  const sidebarHeaderBox = await page.locator('[data-sidebar="header"]').first().boundingBox();
  expect(topbarBox).not.toBeNull();
  expect(sidebarHeaderBox).not.toBeNull();
  expect(Math.abs((topbarBox?.height ?? 0) - (sidebarHeaderBox?.height ?? 0))).toBeLessThanOrEqual(
    1,
  );
  expect(
    Math.abs(
      (topbarBox?.y ?? 0) +
        (topbarBox?.height ?? 0) -
        ((sidebarHeaderBox?.y ?? 0) + (sidebarHeaderBox?.height ?? 0)),
    ),
  ).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.waitForTimeout(250);

  const collapsedSidebarBox = await page.locator('[data-sidebar="sidebar"]').first().boundingBox();
  const firstIconBox = await page.locator('[data-sidebar="menu-button"] svg').first().boundingBox();
  expect(collapsedSidebarBox).not.toBeNull();
  expect(firstIconBox).not.toBeNull();
  expect(collapsedSidebarBox?.width ?? 0).toBeLessThanOrEqual(56);
  expect(firstIconBox?.width ?? 0).toBeGreaterThanOrEqual(15);
  expect(firstIconBox?.height ?? 0).toBeGreaterThanOrEqual(15);
});
