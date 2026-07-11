import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1" &&
  process.env.NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1";

test.skip(!enabled, "Enable controlled mock auth and realtime UI for coordination evidence.");

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("uses full RepairOS skeletons instead of route loading text", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });

  await page.goto("/orders");
  await expect(page.locator('[data-ui="order-list-skeleton"]')).toBeVisible();
  await expect(page.getByText("正在加载工单...")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("mobile-order-full-frame-skeleton.png"),
    fullPage: false,
  });
  await expect(page.locator('[data-order-mobile-list="true"]')).toBeVisible();

  await page.unroute("**/api/repairdesk/orders/queue-summary");
  await page.route("**/api/repairdesk/customers/list-page", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto("/customers");
  await expect(page.locator('[data-ui="customer-list-skeleton"]')).toBeVisible();
  await expect(page.getByText("正在加载客户...")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("mobile-customer-full-frame-skeleton.png"),
    fullPage: false,
  });
  await expect(page.locator('[data-ui="customer-list-skeleton"]')).toBeHidden();
});

test("keeps a real back action in the cold mobile detail frame", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/order/get", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });

  await page.goto("/orders/ord_1");
  await expect(page.locator('[data-ui="order-detail-skeleton"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "返回工单列表" })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("mobile-order-detail-full-frame-skeleton.png"),
    fullPage: false,
  });

  await expect(page.locator('[data-mobile-order-page="true"]')).toBeVisible();
});

test("warms two order details and reuses the first request when the dialog opens", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const detailRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/repairdesk/order/get")) {
      detailRequests.push(request.postData() ?? "");
    }
  });

  await page.goto("/orders");
  const firstRow = page.locator('[data-order-row="true"]').first();
  await expect(firstRow).toBeVisible();
  await expect.poll(() => detailRequests.length).toBe(2);
  await page.waitForTimeout(700);
  expect(detailRequests).toHaveLength(2);

  await firstRow.click();
  await expect(page.locator('[data-order-detail-dialog-shell="true"]')).toBeVisible();
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
  await page.waitForTimeout(400);
  expect(detailRequests).toHaveLength(2);
  await expectNoPageOverflow(page);

  await page.screenshot({
    path: testInfo.outputPath("desktop-preloaded-order-detail.png"),
    fullPage: false,
  });
});

test("keeps customer rows visible while a filtered result refreshes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/customers");
  const firstRow = page.locator("main tbody tr").first();
  await expect(firstRow).toContainText("张伟");

  await page.route("**/api/repairdesk/customers/list-page", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  const search = page.getByPlaceholder("搜索姓名、电话或设备").filter({ visible: true });
  await search.fill("王");

  await expect(page.locator('[data-ui="customer-list-refreshing"]')).toBeVisible();
  await expect(page.locator('[data-ui="customer-list-skeleton"]')).toHaveCount(0);
  await expect(firstRow).toContainText("张伟");
  await page.screenshot({
    path: testInfo.outputPath("desktop-customer-background-refresh.png"),
    fullPage: false,
  });

  await expect(page.locator('[data-ui="customer-list-refreshing"]')).toBeHidden();
  await expect(page.locator("main tbody tr").first()).toContainText("王");
});

test("preloads the customer workspace once and reuses it during SPA navigation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const customerRequests: string[] = [];
  const orderRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/repairdesk/customers/list-page")
    ) {
      customerRequests.push(request.url());
    }
    if (
      request.method() === "POST" &&
      request.url().includes("/api/repairdesk/orders/queue-summary")
    ) {
      orderRequests.push(request.url());
    }
  });

  await page.goto("/orders");
  await expect(page.locator('[data-order-desktop-list="true"]')).toBeVisible();
  await expect.poll(() => orderRequests.length).toBe(1);
  await expect.poll(() => customerRequests.length).toBe(1);
  await expect(page.locator("[data-realtime-sync-state]:visible")).toHaveCount(1);

  const customerLink = page.locator('[data-sidebar="sidebar"] a[href="/customers"]');
  await expect(customerLink).toHaveCount(1);
  await customerLink.click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.locator("main table")).toBeVisible();
  await expect.poll(() => customerRequests.length).toBe(1);
  await expectNoPageOverflow(page);

  await page.screenshot({
    path: testInfo.outputPath("desktop-customer-warm-navigation.png"),
    clip: { x: 0, y: 0, width: 1440, height: 780 },
  });
});

test("keeps the realtime state compact in the mobile order header", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders");

  await expect(page.locator('[data-order-mobile-list="true"]')).toBeVisible();
  await expect(page.locator("[data-realtime-sync-state]:visible")).toHaveCount(1);
  await expectNoPageOverflow(page);

  await page.screenshot({
    path: testInfo.outputPath("mobile-order-realtime-state.png"),
    clip: { x: 0, y: 0, width: 390, height: 760 },
  });
});

test("keeps preloaded workspaces within compact phone and tablet viewports", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/orders");
  await expect(page.locator('[data-order-mobile-list="true"]')).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("mobile-430-order-workspace.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/customers");
  await expect(page.locator("main table")).toBeVisible();
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("tablet-1024-customer-workspace.png"),
    fullPage: false,
  });
});
