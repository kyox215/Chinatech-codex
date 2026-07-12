import { expect, test, type Page } from "@playwright/test";

async function gotoWithStableStoreShell(page: Page, path: string) {
  const storeContext = page.waitForResponse(
    (response) => response.url().includes("/api/repairdesk/stores/context") && response.ok(),
  );
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await storeContext;
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

test("mobile shell uses drawer navigation and one global quick action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoWithStableStoreShell(page, "/buyback");

  await expect(page.getByRole("button", { name: "打开快捷操作" })).toHaveCount(1);

  const bottomNavCount = await page.locator("nav").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const style = window.getComputedStyle(node);
        return style.position === "fixed" && style.bottom !== "auto";
      }).length,
  );
  expect(bottomNavCount).toBe(0);

  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(page.getByRole("dialog", { name: "导航菜单" })).toBeVisible();
  await expect(page.getByRole("link", { name: /订单管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /客户管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /回收管理/ })).toBeVisible();
});

test("desktop sidebar lines and collapsed icon size stay stable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoWithStableStoreShell(page, "/orders");

  const topbar = page.locator('[data-app-bar="true"]');
  const sidebarHeader = page.locator('[data-sidebar="header"]').first();
  await expect(topbar).toBeVisible();
  await expect(sidebarHeader).toBeVisible();
  const topbarBox = await topbar.boundingBox();
  const sidebarHeaderBox = await sidebarHeader.boundingBox();
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

  const sidebarTrigger = page.locator('[data-sidebar="trigger"]:visible');
  await expect(sidebarTrigger).toHaveCount(1);
  await sidebarTrigger.click();
  await page.waitForTimeout(250);

  const collapsedSidebarBox = await page.locator('[data-sidebar="sidebar"]').first().boundingBox();
  const firstIconBox = await page.locator('[data-sidebar="menu-button"] svg').first().boundingBox();
  expect(collapsedSidebarBox).not.toBeNull();
  expect(firstIconBox).not.toBeNull();
  expect(collapsedSidebarBox?.width ?? 0).toBeLessThanOrEqual(56);
  expect(firstIconBox?.width ?? 0).toBeGreaterThanOrEqual(15);
  expect(firstIconBox?.height ?? 0).toBeGreaterThanOrEqual(15);
});
