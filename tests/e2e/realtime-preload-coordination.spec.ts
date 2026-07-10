import { expect, test } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1" &&
  process.env.NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1";

test.skip(!enabled, "Enable controlled mock auth and realtime UI for coordination evidence.");

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
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath("mobile-order-realtime-state.png"),
    clip: { x: 0, y: 0, width: 390, height: 760 },
  });
});
