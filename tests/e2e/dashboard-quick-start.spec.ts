import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";

const viewports = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

test.skip(!enabled, "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 for dashboard handoff checks.");

for (const viewport of viewports) {
  test(`dashboard handoff is direct and overflow-safe at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    await gotoReady(page, "/");

    await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator('[aria-label="状态分组"]')).toHaveCount(0);

    const intake = page.locator('[data-dashboard-quick-start="new-order"]:visible');
    const buyback = page.locator('[data-dashboard-quick-start="buyback-quote"]:visible');
    await expect(intake).toHaveCount(1);
    await expect(buyback).toHaveCount(1);
    await expect(intake).toHaveAttribute("href", "/orders/new");
    await expect(buyback).toHaveAttribute("href", "/buyback?new=1");

    const firstPriority = page.locator('[data-ui="dashboard-priority-card"]').first();
    await expect(firstPriority).toBeVisible({ timeout: 15_000 });
    await expect(firstPriority.getByText(/第 \d+ 优先/)).toBeVisible();
    await expect(firstPriority.getByText("当前步骤", { exact: true })).toBeVisible();
    await expect(firstPriority.getByText("下一步", { exact: true })).toBeVisible();
    await expect(firstPriority.getByText("负责人", { exact: true })).toBeVisible();
    await expect(firstPriority.locator("time")).toHaveCount(1);

    if (viewport.width < 768) {
      const quickStart = page.locator('[data-ui="dashboard-quick-start-mobile"]');
      await expect(quickStart).toBeVisible();
      await expect(page.locator('[data-ui="dashboard-quick-start-desktop"]')).toBeHidden();
      const quickStartBox = await quickStart.boundingBox();
      const priorityBox = await firstPriority.boundingBox();
      expect(quickStartBox).not.toBeNull();
      expect(priorityBox).not.toBeNull();
      expect(quickStartBox?.y ?? 0).toBeLessThan(priorityBox?.y ?? 0);
      await expect(page.locator('[data-mobile-workspace-trigger="true"]')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-ui="dashboard-quick-start-desktop"]')).toBeVisible();
      await expect(page.locator('[data-ui="dashboard-quick-start-mobile"]')).toBeHidden();
    }

    await expectNoPageOverflow(page);

    await intake.click();
    await expect(page).toHaveURL(/\/orders\/new$/);
    await expect(page.locator('[data-new-order-root="true"]')).toBeVisible();

    await gotoReady(page, "/");
    await page.locator('[data-dashboard-quick-start="buyback-quote"]:visible').click();
    await expect(page).toHaveURL(/\/buyback\?new=1$/);
    const buybackDialog = page.getByRole("dialog");
    await expect(buybackDialog).toBeVisible();
    await expect(buybackDialog.getByText("当前只能保存报价与检测", { exact: true })).toBeVisible();
    await expect(
      buybackDialog.getByRole("heading", { name: "选择 iPhone", exact: true }),
    ).toBeVisible();
    await expectNoPageOverflow(page);
  });
}

test("dashboard loading never claims zero work or a safe queue", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/dashboard/priority-summary", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-ui="dashboard-priority-loading"]')).toBeVisible();
  await expect(page.getByText("当前还没有活跃工单")).toHaveCount(0);
  await expect(page.getByText("当前没有超期工单")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-quick-start="new-order"]:visible')).toBeVisible();
});

test("dashboard hard error keeps safe entries and never falls back to a partial queue", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/dashboard/priority-summary", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "temporary_unavailable" }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-ui="dashboard-priority-error"]')).toBeVisible();
  await expect(page.locator('[data-ui="dashboard-priority-card"]')).toHaveCount(0);
  await expect(page.getByText("当前还没有活跃工单")).toHaveCount(0);
  await expect(page.locator('[data-dashboard-quick-start="new-order"]:visible')).toBeVisible();
  await expect(page.locator('[data-dashboard-quick-start="buyback-quote"]:visible')).toBeVisible();
});

test("dashboard distinguishes a filtered empty state from an empty store", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await mockDashboardSummary(page, {
    totalCandidates: 1,
    counts: { overdue: 0, ready: 0, active: 1, waiting: 0 },
    items: [priorityItem()],
  });
  await gotoReady(page, "/");

  await page.locator('[data-dashboard-priority-filter="overdue"]').click();
  await expect(page.locator('[data-ui="dashboard-priority-filter-empty"]')).toHaveText(
    "当前没有超期工单",
  );
  await expect(page.locator('[data-ui="dashboard-priority-empty"]')).toHaveCount(0);
});

test("dashboard never calls a truncated category empty when full counts are non-zero", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardSummary(page, {
    totalCandidates: 27,
    hasMore: true,
    counts: { overdue: 20, ready: 0, active: 0, waiting: 7 },
    items: [priorityItem()],
  });
  await gotoReady(page, "/");

  await page.locator('[data-dashboard-priority-filter="waiting"]').click();
  await expect(page.getByText("完整队列仍有 7 单，请进入完整队列查看。")).toBeVisible();
  await expect(page.getByText("当前没有等待中的工单")).toHaveCount(0);
});

test("dashboard explains a permission denial without offering an endless retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/dashboard/priority-summary", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "forbidden" }),
    });
  });
  await gotoReady(page, "/");

  await expect(page.locator('[data-ui="dashboard-priority-permission-error"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toHaveCount(0);
});

test("dashboard remains readable with long Italian handoff copy on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboardSummary(page, {
    items: [
      priorityItem({
        publicNo: "R-2026-SYNTHETIC-VERY-LONG-000001",
        customerName: "Giovanni Battista Alessandro Rossi Dimostrazione",
        deviceLabel: "Apple iPhone Pro Max dimostrativo con descrizione eccezionalmente lunga",
        reasonDescription:
          "Motivo sintetico molto lungo usato soltanto per verificare la leggibilità del passaggio di consegne.",
        currentStep: "Verifica tecnica sintetica con descrizione molto lunga",
        nextStep:
          "Contattare il cliente sintetico e registrare il prossimo passaggio senza dati reali.",
        assigneeLabel: "Tecnico Dimostrativo con Nome Molto Lungo",
      }),
    ],
  });
  await gotoReady(page, "/");

  await expectNoPageOverflow(page);
  for (const action of ["new-order", "buyback-quote"]) {
    const box = await page
      .locator(`[data-dashboard-quick-start="${action}"]:visible`)
      .boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(120);
    expect(box?.height ?? 0).toBeLessThan(100);
  }
});

test("dashboard priority action only navigates to the permission-checked task page", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const forbiddenWrites: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/api\/repairdesk\/order\/(?:transition|patch|update|payment|notification)(?:\?|$)/.test(
        request.url(),
      )
    ) {
      forbiddenWrites.push(request.url());
    }
  });

  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoReady(page, "/");
  const action = page.locator("[data-dashboard-priority-action]").first();
  await expect(action).toHaveAttribute("href", /\/orders\/[^/]+\/task$/);
  await action.click();
  await expect(page).toHaveURL(/\/orders\/[^/]+\/task$/);
  expect(forbiddenWrites).toEqual([]);
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

async function mockDashboardSummary(
  page: Page,
  overrides: Partial<ReturnType<typeof dashboardSummary>>,
) {
  await page.route("**/api/repairdesk/dashboard/priority-summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...dashboardSummary(), ...overrides } }),
    });
  });
}

function dashboardSummary() {
  return {
    coverage: "store",
    policyVersion: "dashboard-priority-v1",
    generatedAt: "2026-07-16T12:00:00.000Z",
    totalCandidates: 1,
    hasMore: false,
    counts: { overdue: 0, ready: 0, active: 1, waiting: 0 },
    items: [priorityItem()],
  };
}

function priorityItem(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    orderId: "ord_synthetic",
    publicNo: "R-SYNTH-001",
    customerName: "Cliente Demo Molto Lungo",
    deviceLabel: "Apple iPhone dimostrativo con descrizione lunga",
    tier: "active",
    reasonCode: "workflow_action_ready",
    reasonLabel: "可继续推进",
    reasonDescription: "当前步骤已有明确的下一项工作。",
    currentStep: "检测报价",
    nextStep: "完成检测并记录合成测试结果，不包含真实客户资料。",
    assigneeLabel: "Tecnico Demo",
    assigneeState: "assigned",
    isMine: false,
    isOverdue: false,
    isActionable: true,
    updatedAt: "2026-07-16T10:00:00.000Z",
    action: {
      kind: "open_task",
      label: "继续处理",
      href: "/orders/ord_synthetic/task",
    },
    detailHref: "/orders/ord_synthetic",
    ...overrides,
  };
}
