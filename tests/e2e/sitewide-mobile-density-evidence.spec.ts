import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_MOBILE_DENSITY === "1";

test.skip(!enabled, "Enable the controlled mobile-density evidence run.");

const mobileEvidence = [
  { name: "dashboard-390x844", path: "/", ready: "main" },
  {
    name: "order-task-390x844",
    path: "/orders/ord_1/task",
    ready: '[data-order-task-root="true"]',
  },
  { name: "inventory-intake-390x844", path: "/inventory/new", ready: "input" },
  { name: "finance-390x844", path: "/finance", ready: "main" },
  { name: "settings-workflow-390x844", path: "/settings?section=workflow", ready: "main" },
] as const;

test.describe("sitewide mobile density evidence", () => {
  for (const target of mobileEvidence) {
    test(`${target.name} screenshot`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoReady(page, target.path, target.ready);
      await expectNoPageOverflow(page);
      await page.screenshot({
        path: `screenshots/TASK-20260731-002-sitewide-mobile-density/${target.name}.png`,
        animations: "disabled",
      });
    });
  }

  test("finance desktop density remains stable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoReady(page, "/finance", "main");
    await expectNoPageOverflow(page);
    await page.screenshot({
      path: "screenshots/TASK-20260731-002-sitewide-mobile-density/finance-1440x900.png",
      animations: "disabled",
    });
  });
});

async function gotoReady(page: Page, path: string, readySelector: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await page.locator(readySelector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page
    .waitForFunction(
      () =>
        !document.body.innerText.includes("正在恢复 RepairDesk") &&
        !document.body.innerText.includes("Compiling"),
      null,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
