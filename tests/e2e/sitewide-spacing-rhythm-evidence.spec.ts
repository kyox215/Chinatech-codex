import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_SITEWIDE_SPACING_RHYTHM === "1";
const evidenceDir = resolve(
  ".ai-company/memory/tasks/TASK-20260801-002-sitewide-spacing-rhythm-plan/screenshots",
);

const routes = [
  { name: "orders", path: "/orders", ready: '[data-order-mobile-card="true"]' },
  {
    name: "customers",
    path: "/customers",
    ready:
      '[data-ui="customer-mobile-name"], [data-ui="customer-list-empty-state"], [data-ui="customer-list-load-error"]',
  },
  { name: "inventory", path: "/inventory", ready: '[data-ui="inventory-product-card"]' },
  {
    name: "buyback",
    path: "/buyback",
    ready: '[data-ui="buyback-transparent-quote-card"]',
  },
  {
    name: "messages",
    path: "/messages",
    ready:
      '[data-ui="messages-template-enabled-toggle"], [data-ui="messages-template-empty-state"], [data-ui="messages-template-load-error"], [data-ui="messages-template-no-permission"]',
  },
  {
    name: "memos",
    path: "/memos",
    ready: '[aria-label="本店备忘清单"], [aria-label^="打开备忘"], [data-ui="memo-empty-state"]',
  },
  {
    name: "settings",
    path: "/settings",
    ready: "[data-settings-overview]",
  },
  {
    name: "platform",
    path: "/platform",
    ready:
      '[data-ui="platform-onboarding-empty-state"], [data-ui="platform-onboarding-load-error"], table',
  },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_SITEWIDE_SPACING_RHYTHM=1 for spacing evidence.");
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeAll(() => mkdirSync(evidenceDir, { recursive: true }));

for (const { name, path, ready } of routes) {
  test(`${name} keeps the 390px viewport within the page`, async ({ page }, testInfo) => {
    await gotoApp(page, path, ready);
    await expectNoPageOverflow(page);

    if (name === "orders") {
      const header = await page.locator('[data-order-mobile-header-card="true"]').boundingBox();
      expect(header?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(208);

      const standardCards = page.locator(
        '[data-order-mobile-card="true"][data-order-mobile-card-risk="false"]',
      );
      await expect(standardCards.first()).toBeVisible();
      expect(
        (await standardCards.first().boundingBox())?.height ?? Number.POSITIVE_INFINITY,
      ).toBeLessThanOrEqual(112);
      expect(await countFullyVisible(standardCards)).toBeGreaterThanOrEqual(3);

      await page.screenshot({
        path: resolve(evidenceDir, `${name}-${testInfo.project.name}-390x844.png`),
        fullPage: false,
      });

      await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
      await expect(page.locator('[data-order-mobile-header-collapsed="true"]')).toBeVisible();
      const collapsed = await page.locator('[data-order-mobile-header-card="true"]').boundingBox();
      expect(collapsed?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(44);
      await page.screenshot({
        path: resolve(evidenceDir, `${name}-collapsed-${testInfo.project.name}-390x844.png`),
        fullPage: false,
      });
    }

    if (name !== "orders") {
      await page.screenshot({
        path: resolve(evidenceDir, `${name}-${testInfo.project.name}-390x844.png`),
        fullPage: false,
      });
    }
  });
}

test.describe("tablet chrome ownership", () => {
  test.use({ viewport: { width: 834, height: 1112 }, isMobile: false, hasTouch: true });

  test("messages exposes one search field below the desktop breakpoint", async ({ page }) => {
    await gotoApp(
      page,
      "/messages",
      '[data-ui="messages-template-enabled-toggle"], [data-ui="messages-template-empty-state"]',
    );
    await expectSingleVisible(page.getByPlaceholder("搜索模板"));
  });

  test("settings exposes one return path below the desktop breakpoint", async ({ page }) => {
    await gotoApp(page, "/settings?section=store", "[data-settings-content]");
    await expectSingleVisible(page.getByRole("link", { name: "返回设置总览" }));
  });
});

async function gotoApp(page: Page, path: string, ready: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("main").last()).toBeVisible({ timeout: 20_000 });
  await page.locator(ready).first().waitFor({ state: "visible", timeout: 30_000 });
  await page
    .locator('[data-ui="customer-list-skeleton"]')
    .waitFor({ state: "detached" })
    .catch(() => undefined);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function countFullyVisible(locator: ReturnType<Page["locator"]>) {
  return locator.evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const box = element.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      }).length,
  );
}

async function expectSingleVisible(locator: ReturnType<Page["locator"]>) {
  expect(
    await locator.evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const style = window.getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.width > 0 &&
            box.height > 0
          );
        }).length,
    ),
  ).toBe(1);
}
