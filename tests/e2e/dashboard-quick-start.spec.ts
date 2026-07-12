import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for dashboard quick-start checks.");

for (const viewport of viewports) {
  test(`dashboard quick actions are direct and overflow-safe at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await gotoReady(page, "/");

    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);

    const intake = page.locator('[data-dashboard-quick-start="new-order"]:visible');
    const buyback = page.locator('[data-dashboard-quick-start="buyback-quote"]:visible');

    await expect(intake).toHaveCount(1);
    await expect(buyback).toHaveCount(1);
    await expect(intake).toHaveAttribute("href", "/orders/new");
    await expect(buyback).toHaveAttribute("href", "/buyback?new=1");

    if (viewport.width < 768) {
      await expect(page.locator('[data-ui="dashboard-quick-start-mobile"]')).toBeVisible();
      const quickStartBox = await page
        .locator('[data-ui="dashboard-quick-start-mobile"]')
        .boundingBox();
      const priorityBox = await page.getByText("今日优先级", { exact: true }).boundingBox();
      expect(quickStartBox).not.toBeNull();
      expect(priorityBox).not.toBeNull();
      expect(quickStartBox?.y ?? 0).toBeLessThan(priorityBox?.y ?? 0);
    } else {
      await expect(page.locator('[data-ui="dashboard-quick-start-desktop"]')).toBeVisible();
    }

    await expectNoPageOverflow(page);

    await intake.click();
    await expect(page).toHaveURL(/\/orders\/new$/);
    await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();

    await gotoReady(page, "/");
    await page.locator('[data-dashboard-quick-start="buyback-quote"]:visible').click();
    await expect(page).toHaveURL(/\/buyback\?new=1$/);
    await expect(page.getByRole("dialog", { name: "回收报价" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "选择 iPhone", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
  });
}

test("dashboard does not show a false empty insight while its summary is loading", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/dashboard/summary", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-ui="dashboard-work-insight-loading"]')).toBeVisible();
  await expect(page.getByText("今天还没有工单压力")).toHaveCount(0);
  await expect(page.getByText("开始第一笔业务")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-quick-start="new-order"]:visible')).toBeVisible();
});

test("dashboard reports unavailable data without false empty or low-risk conclusions", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const endpoint of [
    "**/api/repairdesk/dashboard/summary",
    "**/api/repairdesk/orders/queue-summary",
  ]) {
    await page.route(endpoint, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "temporary_unavailable" }),
      });
    });
  }

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-ui="dashboard-summary-error"]')).toBeVisible();
  await expect(page.locator('[data-ui="dashboard-queue-error"]')).toBeVisible();
  await expect(page.getByText("开始第一笔业务")).toHaveCount(0);
  await expect(page.getByText("当前队列风险较低")).toHaveCount(0);
  await expect(page.getByText("今日任务 · 待处理 0 单")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-quick-start="new-order"]:visible')).toBeVisible();
});

async function gotoReady(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}
