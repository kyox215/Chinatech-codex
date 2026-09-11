import { expect, test, type Page } from "@playwright/test";

async function gotoWithStableStoreShell(page: Page, path: string) {
  const storeContext = page.waitForResponse(
    (response) => response.url().includes("/api/repairdesk/stores/context") && response.ok(),
  );
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await storeContext;
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
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
  await expect(page.getByRole("link", { name: /维修工单/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /客户管理/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /回收管理/ })).toBeVisible();
});

test("scheme-three desktop uses an independent search and a collapsible flat text rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoWithStableStoreShell(page, "/orders");

  const topbar = page.locator('[data-app-bar="true"]');
  const sidebarHeader = page.locator('[data-sidebar="header"]').first();
  await expect(topbar).toBeVisible();
  await expect(sidebarHeader).toBeVisible();
  const languageTrigger = topbar.locator('[data-language-switcher-trigger="true"]');
  await expect(languageTrigger).toHaveCSS("width", "44px");
  await expect(languageTrigger).toHaveCSS("height", "44px");
  await expect(topbar).toHaveCSS("height", "54px");
  const search = sidebarHeader.locator("[data-workspace-search-trigger]");
  await expect(search).toHaveCount(1);
  const searchBox = await search.boundingBox();
  const brandBox = await sidebarHeader.locator(".scheme-three-sidebar-brand").boundingBox();
  expect(searchBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height);
  expect(searchBox!.width).toBeGreaterThan(140);
  await expect(page.locator("[data-shell-navigation-links] svg")).toHaveCount(0);
  await expect(page.locator("[data-shell-business-group]")).toHaveCount(0);
  const sidebarTrigger = page.locator("[data-shell-collapse-trigger]:visible");
  await expect(sidebarTrigger).toHaveCount(1);
  await sidebarTrigger.click();
  await expect
    .poll(async () =>
      Math.round((await page.locator('[data-sidebar="sidebar"]').first().boundingBox())!.width),
    )
    .toBe(75);
  await expect(page.locator('[data-shell-navigation-links] a[href="/orders"]')).toBeVisible();
  await expect(
    page.locator("[data-shell-navigation-links] .scheme-three-nav-short").first(),
  ).toBeVisible();
  await expect(search).toBeVisible();
  await sidebarTrigger.click();
  await expect
    .poll(async () =>
      Math.round((await page.locator('[data-sidebar="sidebar"]').first().boundingBox())!.width),
    )
    .toBe(215);
});
