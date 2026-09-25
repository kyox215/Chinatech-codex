import { expect, test, type Locator, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Enable the controlled RepairDesk mock auth environment.");

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function boxes(locator: Locator, count: number, exact = true) {
  if (exact) await expect(locator).toHaveCount(count);
  else await expect(locator.nth(count - 1)).toBeVisible();
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const box = await locator.nth(index).boundingBox();
      expect(box).not.toBeNull();
      return box!;
    }),
  );
}

function delayedRequest(page: Page, pattern: string) {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    install: () =>
      page.route(pattern, async (route) => {
        await gate;
        await route.continue();
      }),
    release: () => release?.(),
  };
}

test("keeps real navigation and card boundaries available on mobile while loading", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const orderRequest = delayedRequest(page, "**/api/repairdesk/orders/queue-summary");
  await orderRequest.install();

  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  const orderSkeleton = page.locator('[data-ui="order-list-skeleton"]:visible');
  const navigationTrigger = orderSkeleton.locator('[data-sidebar="trigger"]');
  const loadingOrderCard = page.locator('[data-order-mobile-skeleton-card="true"]:visible').first();
  await expect(orderSkeleton).toBeVisible();
  await expect(navigationTrigger).toBeVisible();
  await navigationTrigger.click();
  await expect(
    page.locator('[data-workbench-navigation="true"][data-mobile="true"]:visible'),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const loadingOrderBox = (await loadingOrderCard.boundingBox())!;
  expect(loadingOrderBox.height).toBeGreaterThanOrEqual(150);
  await page.screenshot({
    path: testInfo.outputPath("orders-390-loading.png"),
    animations: "disabled",
  });

  orderRequest.release();
  const loadedOrderCard = page.locator('[data-order-mobile-card="true"]:visible').first();
  await expect(loadedOrderCard).toBeVisible();
  const loadedOrderBox = (await loadedOrderCard.boundingBox())!;
  expect(Math.abs(loadingOrderBox.x - loadedOrderBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingOrderBox.width - loadedOrderBox.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingOrderBox.height - loadedOrderBox.height)).toBeLessThanOrEqual(24);
  await expectNoPageOverflow(page);

  await page.unroute("**/api/repairdesk/orders/queue-summary");
  const customerRequest = delayedRequest(page, "**/api/repairdesk/customers/list-page");
  await customerRequest.install();
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  const loadingCustomerCard = page
    .locator('[data-customer-mobile-skeleton-card="true"]:visible')
    .first();
  await expect(loadingCustomerCard).toBeVisible();
  const loadingCustomerBox = (await loadingCustomerCard.boundingBox())!;
  await page.screenshot({
    path: testInfo.outputPath("customers-390-loading.png"),
    animations: "disabled",
  });

  customerRequest.release();
  const loadedCustomerCard = page.locator("[data-customer-open-id]").first();
  await expect(loadedCustomerCard).toBeVisible();
  const loadedCustomerBox = (await loadedCustomerCard.boundingBox())!;
  expect(Math.abs(loadingCustomerBox.x - loadedCustomerBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingCustomerBox.width - loadedCustomerBox.width)).toBeLessThanOrEqual(2);
  await expectNoPageOverflow(page);
});

test("keeps the iPad order skeleton in the same two-column list geometry", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 820, height: 1050 });
  const request = delayedRequest(page, "**/api/repairdesk/orders/queue-summary");
  await request.install();

  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  const skeleton = page.locator('[data-ui="order-list-skeleton"]:visible');
  await expect(skeleton).toBeVisible();
  await expect(skeleton.locator('[data-sidebar="trigger"]')).toBeVisible();
  await expect(skeleton.locator('[data-sidebar="trigger"]')).toBeEnabled();
  const loadingCards = await boxes(
    page.locator('[data-order-mobile-skeleton-card="true"]:visible'),
    4,
  );
  expect(Math.abs(loadingCards[0].y - loadingCards[1].y)).toBeLessThan(2);
  expect(loadingCards[1].x).toBeGreaterThan(loadingCards[0].x + loadingCards[0].width - 2);
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-820-loading.png"),
    animations: "disabled",
  });

  request.release();
  const loadedCards = page.locator('[data-order-mobile-card="true"]:visible');
  await expect(loadedCards.first()).toBeVisible();
  const loaded = await boxes(loadedCards, 2, false);
  expect(loaded).toHaveLength(2);
  expect(Math.abs(loaded[0].y - loaded[1].y)).toBeLessThan(2);
  expect(Math.abs(loadingCards[0].x - loaded[0].x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingCards[0].width - loaded[0].width)).toBeLessThanOrEqual(3);
  await expectNoPageOverflow(page);
});

test("matches the desktop order row and toolbar boundaries", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const request = delayedRequest(page, "**/api/repairdesk/orders/queue-summary");
  await request.install();

  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  const loadingToolbar = page.locator('[data-order-skeleton-desktop-toolbar="true"]:visible');
  const loadingRow = page.locator('[data-order-desktop-skeleton-row="true"]:visible').first();
  await expect(loadingToolbar).toBeVisible();
  const loadingToolbarBox = (await loadingToolbar.boundingBox())!;
  const loadingRowBox = (await loadingRow.boundingBox())!;
  expect(loadingRowBox.height).toBeGreaterThanOrEqual(86);
  await page.screenshot({
    path: testInfo.outputPath("orders-1440-loading.png"),
    animations: "disabled",
  });

  request.release();
  const loadedToolbar = page.locator('[data-order-desktop-unified-toolbar="true"]:visible');
  const loadedRow = page.locator('[data-order-row="true"]:visible').first();
  await expect(loadedToolbar).toBeVisible();
  await expect(loadedRow).toBeVisible();
  const loadedToolbarBox = (await loadedToolbar.boundingBox())!;
  const loadedRowBox = (await loadedRow.boundingBox())!;
  expect(Math.abs(loadingToolbarBox.x - loadedToolbarBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingToolbarBox.width - loadedToolbarBox.width)).toBeLessThanOrEqual(3);
  expect(Math.abs(loadingRowBox.height - loadedRowBox.height)).toBeLessThanOrEqual(18);
  await expectNoPageOverflow(page);
});

test("keeps the customer desktop header and five-column table stable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const request = delayedRequest(page, "**/api/repairdesk/customers/list-page");
  await request.install();

  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  const loadingHeader = page.locator('[data-ui="customer-list-skeleton-desktop-header"]:visible');
  const loadingTable = page.locator('[data-customer-desktop-skeleton-list="true"]:visible');
  await expect(loadingHeader).toBeVisible();
  await expect(loadingTable.locator("thead th")).toHaveCount(5);
  const loadingHeaderBox = (await loadingHeader.boundingBox())!;
  const loadingTableBox = (await loadingTable.boundingBox())!;
  await page.screenshot({
    path: testInfo.outputPath("customers-1440-loading.png"),
    animations: "disabled",
  });

  request.release();
  const loadedHeader = page.locator('[data-ui="customer-list-desktop-header"]:visible');
  const loadedTable = page.locator('[data-customer-desktop-list="true"]:visible');
  await expect(loadedHeader).toBeVisible();
  await expect(loadedTable.locator("thead th")).toHaveCount(5);
  const loadedHeaderBox = (await loadedHeader.boundingBox())!;
  const loadedTableBox = (await loadedTable.boundingBox())!;
  expect(Math.abs(loadingHeaderBox.x - loadedHeaderBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingHeaderBox.width - loadedHeaderBox.width)).toBeLessThanOrEqual(3);
  expect(Math.abs(loadingTableBox.x - loadedTableBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingTableBox.width - loadedTableBox.width)).toBeLessThanOrEqual(3);
  await expectNoPageOverflow(page);
});

test("uses the full desktop order-detail workspace while loading", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const request = delayedRequest(page, "**/api/repairdesk/order/get");
  await request.install();

  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  const loadingRoot = page.locator('[data-ui="order-detail-skeleton"]:visible');
  const loadingWorkbench = page.locator('[data-order-detail-skeleton-workbench="true"]:visible');
  await expect(loadingWorkbench).toBeVisible();
  const loadingRootBox = (await loadingRoot.boundingBox())!;
  const loadingWorkbenchBox = (await loadingWorkbench.boundingBox())!;
  expect(loadingRootBox.width).toBeGreaterThan(1100);
  expect(loadingWorkbenchBox.width).toBeGreaterThan(1100);
  await page.screenshot({
    path: testInfo.outputPath("order-detail-1440-loading.png"),
    animations: "disabled",
  });

  request.release();
  const loadedRoot = page.locator('[data-order-detail-root="true"]:visible');
  const loadedContent = page.locator('[data-order-detail-content-end="true"]:visible').first();
  await expect(loadedRoot).toBeVisible();
  await expect(loadedContent).toBeVisible();
  const loadedRootBox = (await loadedRoot.boundingBox())!;
  const loadedContentBox = (await loadedContent.boundingBox())!;
  expect(Math.abs(loadingRootBox.x - loadedRootBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(loadingRootBox.width - loadedRootBox.width)).toBeLessThanOrEqual(3);
  expect(Math.abs(loadingWorkbenchBox.x - loadedContentBox.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(loadingWorkbenchBox.width - loadedContentBox.width)).toBeLessThanOrEqual(3);
  await expectNoPageOverflow(page);
});
