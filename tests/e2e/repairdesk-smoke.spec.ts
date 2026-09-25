import { translateMessage } from "@/shared/i18n/messages";
import { expect, test } from "@playwright/test";

const synthetic = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const routes = ["/orders", "/orders/new", "/customers", "/buyback", "/inventory"];

test.describe("unauthenticated protected routes", () => {
  test.skip(synthetic, "Run against the normal unauthenticated app, without synthetic auth.");
  for (const route of routes) {
    test(`${route} requires login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("textbox").first()).toBeVisible();
    });
  }
});

test.describe("authenticated synthetic business routes", () => {
  test.skip(!synthetic, "Requires the isolated synthetic auth environment.");
  test.beforeEach(async ({ context, baseURL }) => {
    expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL!).hostname);
    await context.addCookies([{ name: "repairdesk_locale", value: "zh-CN", url: baseURL! }]);
  });
  for (const [route, selector] of [
    ["/orders", '[data-order-desktop-list="true"]'],
    ["/orders/new", '[data-new-order-root="true"]'],
    ["/customers", '[data-customer-desktop-list="true"]'],
    ["/buyback", "h1"],
    ["/inventory", "[data-inventory-product-results]"],
  ]) {
    test(`${route} renders its business content`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
      if (route === "/inventory") {
        // The default fixture deliberately keeps the product rollout disabled.
        await expect(
          page
            .getByRole("heading", {
              name: translateMessage("zh-CN", "inventory2b4.list.unavailableTitle"),
              exact: true,
            })
            .first(),
        ).toBeVisible();
      } else {
        await expect(page.locator(selector).first()).toBeVisible();
      }
      if (route === "/buyback")
        await expect(
          page.getByRole("heading", { name: "回收管理", exact: true }).first(),
        ).toBeVisible();
    });
  }
});
