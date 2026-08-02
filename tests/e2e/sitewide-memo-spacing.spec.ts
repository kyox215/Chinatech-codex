import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const screenshotDir = resolve(
  process.cwd(),
  "artifacts/screenshots/TASK-20260803-001-sitewide-memo-spacing",
);

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for sitewide spacing checks.");

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

for (const route of ["/memos", "/customers", "/inventory"] as const) {
  test(`${route} keeps the shared memo rhythm on mobile and desktop`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page, route);
    await waitForStableRoute(page, route);
    await expectSharedMobileRhythm(page);
    await expectNoOverflow(page);
    await hideNextDevUi(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${browserName}-${route.slice(1)}-390x844.png`),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoApp(page, route);
    await waitForStableRoute(page, route);
    await expect(page.locator('[data-ui="repair-os-list-scaffold"]')).toBeVisible();
    if (route === "/customers") {
      await expect(page.locator('[data-ui="customer-list-pagination"]')).toBeVisible();
      expect(
        await page
          .locator('[data-ui="customer-list-desktop-header"]')
          .evaluate((element) => Number.parseFloat(getComputedStyle(element).marginBottom)),
      ).toBe(24);
      expect(
        await page
          .locator('[data-ui="customer-list-pagination"]')
          .evaluate((element) => Number.parseFloat(getComputedStyle(element).marginTop)),
      ).toBe(24);
    }
    await expectNoOverflow(page);
    await hideNextDevUi(page);
    await page.screenshot({
      path: resolve(screenshotDir, `${browserName}-${route.slice(1)}-1440x900.png`),
      fullPage: true,
    });
  });
}

test("orders keeps its dense queue controls while adopting the same outer rhythm", async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page, "/orders");
  await waitForStableRoute(page, "/orders");

  const headerCard = page.locator('[data-order-mobile-header-card="true"]');
  await expect(headerCard).toBeVisible();
  const queueButtons = page.getByRole("group", { name: "待处理状态" }).getByRole("button");
  await expect(queueButtons.first()).toBeVisible();
  const queueBox = await queueButtons.first().boundingBox();
  expect(queueBox?.height).toBeGreaterThanOrEqual(32);
  expect(queueBox?.height).toBeLessThanOrEqual(40);
  await expectNoOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-orders-390x844.png`),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoApp(page, "/orders");
  await waitForStableRoute(page, "/orders");
  await expect(page.getByRole("heading", { level: 1, name: "维修工单" })).toBeAttached();
  await expectNoOverflow(page);
  await hideNextDevUi(page);
  await page.screenshot({
    path: resolve(screenshotDir, `${browserName}-orders-1440x900.png`),
    fullPage: true,
  });
});

async function gotoApp(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function waitForStableRoute(page: Page, route: string) {
  if (route === "/memos") {
    const subtitle = page.locator('[data-ui="repair-os-list-header-card"] header p').last();
    await expect(subtitle).not.toContainText(/正在确认|正在读取|正在同步/);
  } else if (route === "/customers") {
    await expect(page.locator('[data-ui="customer-list-refreshing"]')).toHaveCount(0);
    await expect(page.locator('[data-ui="customer-list-pagination"]')).toBeVisible();
  } else if (route === "/inventory") {
    await expect(
      page
        .locator(
          '[data-ui="inventory-product-card"]:visible, [data-ui="inventory-product-empty-state"]:visible, [data-ui="inventory-product-load-error"]:visible, a[href^="/inventory/"]:visible',
        )
        .first(),
    ).toBeVisible();
  } else if (route === "/orders") {
    await expect(page.locator('[data-order-list-refreshing="false"]')).toBeVisible();
  }

  await page.waitForTimeout(750);
}

async function expectSharedMobileRhythm(page: Page) {
  const headerShell = page.locator('[data-ui="repair-os-list-header-shell"]');
  const headerCard = page.locator('[data-ui="repair-os-list-header-card"]');
  const content = page.locator('[data-ui="repair-os-list-content"]');
  await expect(headerShell).toBeVisible();
  await expect(headerCard).toBeVisible();
  await expect(content).toBeVisible();

  const [shellBox, cardBox, contentBox] = await Promise.all([
    headerShell.boundingBox(),
    headerCard.boundingBox(),
    content.boundingBox(),
  ]);
  expect(shellBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(contentBox).not.toBeNull();

  const shellGap = contentBox!.y - (shellBox!.y + shellBox!.height);
  const cardGap = contentBox!.y - (cardBox!.y + cardBox!.height);
  expect(shellGap).toBeGreaterThanOrEqual(6);
  expect(shellGap).toBeLessThanOrEqual(10);
  expect(cardGap).toBeGreaterThanOrEqual(14);
  expect(cardGap).toBeLessThanOrEqual(18);
  expect(
    await content.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingTop)),
  ).toBe(8);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

async function hideNextDevUi(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal, [data-next-badge-root] { display: none !important; }",
  });
}
