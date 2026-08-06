import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

test.skip(!enabled, "Enable the controlled RepairDesk mock auth environment.");

async function gotoOrders(page: Page) {
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('[data-order-mobile-list="true"]')).toBeVisible();
  await expect(page.locator('[data-order-mobile-list="true"]')).toHaveCount(1);
  await expect(page.locator('[data-order-desktop-list="true"]')).toHaveCount(0);
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

function queueButton(page: Page, label: string) {
  return page.getByRole("button", {
    name: new RegExp(`^第 \\d+ 阶段：${label}，\\d+ 条$`),
  });
}

test("uses a fluid two-row queue header and compact mobile cards", async ({ page }, testInfo) => {
  const mobileViewports = [
    { width: 320, height: 568 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
    { width: 440, height: 956 },
  ];

  await page.setViewportSize(mobileViewports[0]);
  await gotoOrders(page);

  await expect(page.getByRole("button", { name: "筛选订单" })).toBeVisible();
  await expect(queueButton(page, "等待客户取机")).toBeVisible();
  await expect(page.getByText("队列：等待客户取机")).toHaveCount(0);

  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await expectNoOverflow(page);

    const all = await queueButton(page, "全部任务").boundingBox();
    const processing = await queueButton(page, "正在处理").boundingBox();
    const ordered = await queueButton(page, "等待配件").boundingBox();
    const arrived = await queueButton(page, "配件已到").boundingBox();
    const pickup = await queueButton(page, "等待客户取机").boundingBox();
    const header = await page.locator('[data-order-mobile-header-card="true"]').boundingBox();
    const title = await page
      .locator('[data-order-mobile-title-block="true"] > p')
      .first()
      .boundingBox();
    const subtitle = await page.locator('[data-order-mobile-header-context="true"]').boundingBox();
    const titleBlock = await page.locator('[data-order-mobile-title-block="true"]').boundingBox();
    const searchRow = await page.locator('[data-order-mobile-search-row="true"]').boundingBox();
    const rangeGroup = await page.getByRole("group", { name: "订单显示范围" }).boundingBox();

    expect(all).not.toBeNull();
    expect(processing).not.toBeNull();
    expect(ordered).not.toBeNull();
    expect(arrived).not.toBeNull();
    expect(pickup).not.toBeNull();
    expect(header).not.toBeNull();
    expect(title).not.toBeNull();
    expect(subtitle).not.toBeNull();
    expect(titleBlock).not.toBeNull();
    expect(searchRow).not.toBeNull();
    expect(rangeGroup).not.toBeNull();
    expect((subtitle?.y ?? 0) - ((title?.y ?? 0) + (title?.height ?? 0))).toBeGreaterThanOrEqual(3);
    expect((subtitle?.y ?? 0) - ((title?.y ?? 0) + (title?.height ?? 0))).toBeLessThanOrEqual(5);
    expect(
      (searchRow?.y ?? 0) - ((titleBlock?.y ?? 0) + (titleBlock?.height ?? 0)),
    ).toBeGreaterThanOrEqual(7);
    expect(
      (searchRow?.y ?? 0) - ((titleBlock?.y ?? 0) + (titleBlock?.height ?? 0)),
    ).toBeLessThanOrEqual(10);
    expect(
      (rangeGroup?.y ?? 0) - ((searchRow?.y ?? 0) + (searchRow?.height ?? 0)),
    ).toBeGreaterThanOrEqual(9);
    expect(
      (rangeGroup?.y ?? 0) - ((searchRow?.y ?? 0) + (searchRow?.height ?? 0)),
    ).toBeLessThanOrEqual(11);
    expect(Math.abs((all?.y ?? 0) - (processing?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((processing?.y ?? 0) - (ordered?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((arrived?.y ?? 0) - (pickup?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((processing?.y ?? 0) - (arrived?.y ?? 0))).toBeGreaterThan(28);
    expect(processing?.height ?? 0).toBeGreaterThanOrEqual(32);
    // The balanced rhythm adds hierarchy spacing without enlarging queue controls.
    expect(header?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(224);

    await page.screenshot({
      path: testInfo.outputPath(`orders-${viewport.width}-fluid-density.png`),
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const groupHeader = page
    .locator('[data-order-mobile-list="true"] [data-order-result-group]')
    .first();
  await expect(groupHeader).toBeVisible();
  const firstGroupHeader = await groupHeader.boundingBox();
  expect(firstGroupHeader?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(40);
  const standardCards = page.locator(
    '[data-order-mobile-card="true"][data-order-mobile-card-risk="false"]',
  );
  await expect(standardCards.first()).toBeVisible();
  const firstCard = await standardCards.first().boundingBox();
  expect(firstCard?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(108);
  const completeCardCount = await standardCards.evaluateAll(
    (cards) =>
      cards.filter((card) => {
        const box = card.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      }).length,
  );
  expect(completeCardCount).toBeGreaterThanOrEqual(3);

  await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
  await expect(page.locator('[data-order-mobile-header-collapsed="true"]')).toBeVisible();
  const collapsedHeader = await page
    .locator('[data-order-mobile-header-card="true"]')
    .boundingBox();
  expect(collapsedHeader?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(44);
  await page.screenshot({
    path: testInfo.outputPath("orders-390-collapsed-density.png"),
    fullPage: false,
  });
  const collapsedCompleteCardCount = await standardCards.evaluateAll(
    (cards) =>
      cards.filter((card) => {
        const box = card.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      }).length,
  );
  expect(collapsedCompleteCardCount).toBeGreaterThanOrEqual(5);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByRole("button", { name: "筛选", exact: true })).toHaveCount(0);
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-768-desktop-toolbar.png"),
    clip: { x: 0, y: 0, width: 768, height: 330 },
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: "筛选", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-order-desktop-list="true"]')).toHaveCount(1);
  await expect(page.locator('[data-order-mobile-list="true"]')).toHaveCount(0);
  await expectNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("orders-1440-desktop-toolbar.png"),
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
  let releaseOrderedRequest: (() => void) | undefined;
  const orderedRequestGate = new Promise<void>((resolve) => {
    releaseOrderedRequest = resolve;
  });
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const input = (route.request().postDataJSON() ?? {}) as { queueGroups?: string[] };
    const group = input.queueGroups?.[0];
    if (group && group === failingGroup && failingAttempts > 0) {
      failingAttempts -= 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }
    if (group === "ordered") await orderedRequestGate;
    const delay = group === "arrived" ? 1_000 : group === "repaired" ? 500 : 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });

  const ordered = queueButton(page, "等待配件");
  await ordered.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(ordered).toHaveAttribute("aria-busy", "true");
  await expect(page.locator('[data-order-mobile-header-context="true"]')).toContainText(
    "正在加载等待配件",
  );
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("orders-390-queue-loading.png"),
    clip: { x: 0, y: 0, width: 390, height: 360 },
  });
  releaseOrderedRequest?.();

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
    if (
      request.method() === "POST" &&
      request.url().includes("/api/repairdesk/orders/queue-summary")
    ) {
      listPageRequests += 1;
    }
  });

  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  const offlineStatus = page.getByRole("status").filter({ hasText: "当前离线，显示最近数据" });
  await expect(offlineStatus).toBeVisible();

  await expect(queueButton(page, "等待配件")).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "搜索工单、客户、电话或 IMEI" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "扫描订单二维码" })).toBeDisabled();
  await expect(queueButton(page, "全部任务")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-order-list-blocked="true"]')).toBeHidden();
  expect(listPageRequests).toBe(0);

  await page.context().setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(offlineStatus).toBeHidden();
});
