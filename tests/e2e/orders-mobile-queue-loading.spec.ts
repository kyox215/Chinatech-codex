import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Enable the controlled RepairDesk mock auth environment.");

async function gotoOrders(page: Page) {
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('[data-order-mobile-list="true"]')).toBeVisible();
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

function queueButton(page: Page, label: string) {
  return page.getByRole("button", { name: new RegExp(`^${label} \\d+ 条$`) });
}

test("uses the compact responsive queue header without the mobile funnel", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await gotoOrders(page);

  await expect(page.getByRole("button", { name: "筛选订单" })).toHaveCount(0);
  await expect(queueButton(page, "等待客户取机")).toBeVisible();
  await expect(page.getByText("队列：等待客户取机")).toHaveCount(0);
  await expectNoOverflow(page);

  const processing320 = await queueButton(page, "正在处理").boundingBox();
  const arrived320 = await queueButton(page, "配件已到").boundingBox();
  expect(processing320).not.toBeNull();
  expect(arrived320).not.toBeNull();
  expect(Math.abs((processing320?.y ?? 0) - (arrived320?.y ?? 0))).toBeGreaterThan(20);
  await page.screenshot({
    path: testInfo.outputPath("orders-320-two-column.png"),
    clip: { x: 0, y: 0, width: 320, height: 390 },
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  const processing390 = await queueButton(page, "正在处理").boundingBox();
  const arrived390 = await queueButton(page, "配件已到").boundingBox();
  expect(processing390).not.toBeNull();
  expect(arrived390).not.toBeNull();
  expect(Math.abs((processing390?.y ?? 0) - (arrived390?.y ?? 0))).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: testInfo.outputPath("orders-390-three-column.png"),
    clip: { x: 0, y: 0, width: 390, height: 340 },
  });

  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-430-three-column.png"),
    clip: { x: 0, y: 0, width: 430, height: 340 },
  });

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole("button", { name: "筛选", exact: true })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-768-desktop-toolbar.png"),
    clip: { x: 0, y: 0, width: 768, height: 330 },
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: "筛选", exact: true })).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-1440-desktop-filter.png"),
    clip: { x: 0, y: 0, width: 1440, height: 330 },
  });
});

test("blocks stale rows, commits only the latest queue, and restores after failure", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let workflowRequests = 0;
  let optionsRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/repairdesk/order-workflow")) workflowRequests += 1;
    if (request.url().includes("/api/repairdesk/options")) optionsRequests += 1;
  });
  await gotoOrders(page);
  const initialWorkflowRequests = workflowRequests;
  const initialOptionsRequests = optionsRequests;

  let failingGroup: string | null = null;
  let failingAttempts = 0;
  await page.route("**/api/repairdesk/orders/list-page", async (route) => {
    const input = (route.request().postDataJSON() ?? {}) as { queueGroups?: string[] };
    const group = input.queueGroups?.[0];
    if (group && group === failingGroup && failingAttempts > 0) {
      failingAttempts -= 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    const delay =
      group === "ordered" ? 700 : group === "arrived" ? 450 : group === "repaired" ? 120 : 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });

  const ordered = queueButton(page, "等待配件");
  await ordered.click();
  await expect(ordered).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status").filter({ hasText: "正在加载等待配件" })).toBeVisible();
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("orders-390-queue-loading.png"),
    clip: { x: 0, y: 0, width: 390, height: 360 },
  });

  await queueButton(page, "配件已到").click();
  await queueButton(page, "待通知取机").click();
  await expect(queueButton(page, "待通知取机")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeHidden();
  await expect(queueButton(page, "待通知取机")).toHaveAttribute("aria-pressed", "true");
  expect(workflowRequests).toBe(initialWorkflowRequests);
  expect(optionsRequests).toBe(initialOptionsRequests);

  const repairedNotified = queueButton(page, "等待客户取机");
  failingGroup = "repaired_notified";
  failingAttempts = 2;
  await repairedNotified.click();
  const failureAlert = page.getByRole("alert").filter({
    hasText: "已恢复上一次成功队列",
  });
  await expect(failureAlert).toBeVisible();
  await expect(queueButton(page, "待通知取机")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeHidden();

  await page.getByRole("button", { name: "重试" }).click();
  await expect(failureAlert).toBeHidden();
  await expect(repairedNotified).toHaveAttribute("aria-pressed", "true");
  await expectNoOverflow(page);
});

test("keeps the last successful queue visible and stops transitions while offline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoOrders(page);

  let listPageRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/repairdesk/orders/list-page")) {
      listPageRequests += 1;
    }
  });

  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  const offlineStatus = page.getByRole("status").filter({ hasText: "当前离线，显示最近数据" });
  await expect(offlineStatus).toBeVisible();

  await expect(queueButton(page, "等待配件")).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "搜索订单、客户或手机" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "订单扫码查询" })).toBeDisabled();
  await expect(queueButton(page, "全部任务")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeHidden();
  expect(listPageRequests).toBe(0);

  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(offlineStatus).toBeHidden();
});
