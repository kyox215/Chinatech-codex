import { expect, test, type Page, type Route } from "@playwright/test";
import type { OrderQueueSummary } from "../../src/lib/repairdesk/types";

test.skip(
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP !== "1",
  "Requires the controlled RepairDesk mock auth environment.",
);

test.afterEach(async ({ page }) => {
  // Drain active read callbacks before Playwright closes their request context.
  await page.unrouteAll({ behavior: "wait" });
});

const batchPath = "**/api/repairdesk/order/batch-transition";
const ids = ["bulk-synthetic-success", "bulk-synthetic-failure"];
const publicNumbers = ["CT-BULK-001", "CT-BULK-002"];
const sentinel = "SECRET_SENTINEL_NEVER_DISPLAY";
type BatchRequest = { ids: string[]; to: string };

async function setup(page: Page) {
  const unexpectedMutations: string[] = [];
  const completed = new Set<string>();
  let refreshes = 0;
  await page.route("**/api/**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const readPost =
      request.method() === "POST" &&
      [
        "/api/repairdesk/orders/queue-summary",
        "/api/repairdesk/orders/list-page",
        "/api/repairdesk/order/get",
        "/api/repairdesk/customers/list-page",
        "/api/repairdesk/inventory/summary",
      ].includes(path);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !readPost) {
      unexpectedMutations.push(path);
      return route.abort();
    }
    return route.continue();
  });
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as { data: OrderQueueSummary };
    const template = payload.data.list.items[0];
    expect(template).toBeTruthy();
    payload.data.list.items = ids.flatMap((id, index) =>
      completed.has(id)
        ? []
        : [
            {
              ...template,
              id,
              public_no: publicNumbers[index],
              status: "new",
              workflow_status: "intake",
              workflow_bucket: "intake",
              exception_status: undefined,
              record_state: "active",
              deleted_at: undefined,
              completed_at: undefined,
            },
          ],
    );
    payload.data.list.total = payload.data.list.items.length;
    payload.data.list.pageCount = 1;
    payload.data.workflow.transitions = [
      {
        id: "synthetic-new-diagnosing",
        store_id: "mock-store",
        from_status_code: "new",
        to_status_code: "diagnosing",
        enabled: true,
        is_primary: true,
        sort_order: 1,
        created_at: "",
        updated_at: "",
      },
    ];
    refreshes += 1;
    await route.fulfill({ response, json: payload });
  });
  // An explicit local response is required for every mutation; none reaches the app server.
  await page.route(batchPath, (route) =>
    route.fulfill({
      json: {
        data: { ok: false, count: 0, failures: ids.map((id) => ({ id, reason: "CONFLICT" })) },
      },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().addCookies([
    {
      name: "repairdesk_locale",
      value: "zh-CN",
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    },
  ]);
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-order-desktop-list="true"]')).toBeVisible();
  for (const publicNo of publicNumbers) {
    await page.getByRole("checkbox", { name: new RegExp(publicNo) }).check();
  }
  return { completed, unexpectedMutations, refreshes: () => refreshes };
}

async function submit(page: Page) {
  await page.getByRole("button", { name: "批量流转状态", exact: true }).click();
  await page.getByRole("menuitem", { name: "检测", exact: true }).click();
}

async function reply(route: Route, count: number, failedIds: string[], reason = "CONFLICT") {
  await route.fulfill({
    json: {
      data: {
        ok: failedIds.length === 0,
        count,
        failures: failedIds.map((id) => ({ id, reason })),
      },
    },
  });
}

test("retains only failed orders through refresh and retries only them once", async ({
  page,
}, testInfo) => {
  const state = await setup(page);
  const requests: BatchRequest[] = [];
  let releaseRetry: (() => void) | undefined;
  const retryGate = new Promise<void>((resolve) => {
    releaseRetry = resolve;
  });
  await page.route(batchPath, async (route) => {
    const input = route.request().postDataJSON() as BatchRequest;
    requests.push(input);
    if (requests.length === 1) {
      state.completed.add(ids[0]);
      await reply(route, 1, [ids[1]], sentinel);
      return;
    }
    await retryGate;
    state.completed.add(ids[1]);
    await reply(route, 1, []);
  });
  await submit(page);
  const feedback = page.locator('[data-order-bulk-feedback="true"]');
  await expect(feedback).toContainText(publicNumbers[1]);
  await expect(feedback).not.toContainText(publicNumbers[0]);
  await expect(feedback).toContainText("流转失败，请核对工单后重试");
  await expect(feedback).not.toContainText(sentinel);
  await expect(feedback).not.toContainText(ids[1]);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect.poll(state.refreshes).toBeGreaterThan(1);
  await expect(page.getByRole("checkbox", { name: new RegExp(publicNumbers[0]) })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: new RegExp(publicNumbers[1]) })).toBeChecked();
  for (const width of [1440, 390, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(feedback).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`bulk-partial-${width}.png`),
      animations: "disabled",
    });
  }
  await feedback.getByRole("button", { name: "重试失败工单" }).click();
  await expect(feedback.getByRole("button", { name: "正在重试…" })).toBeDisabled();
  expect(requests).toEqual([
    { ids, to: "diagnosing" },
    { ids: [ids[1]], to: "diagnosing" },
  ]);
  releaseRetry?.();
  await expect(feedback).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除选择", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toContainText("已将 1 条流转为");
  expect(state.unexpectedMutations).toEqual([]);
});

for (const failure of ["forbidden", "network"] as const) {
  test(`retains the original selection after ${failure} and safely retries`, async ({
    page,
  }, testInfo) => {
    const state = await setup(page);
    const requests: BatchRequest[] = [];
    await page.route(batchPath, async (route) => {
      requests.push(route.request().postDataJSON() as BatchRequest);
      if (requests.length > 1) return reply(route, 2, []);
      if (failure === "network") return route.abort("failed");
      await route.fulfill({ status: 403, json: { error: sentinel, code: "FORBIDDEN" } });
    });
    await submit(page);
    const feedback = page.locator('[data-order-bulk-feedback="true"]');
    await expect(feedback).toContainText("未能确认批量流转结果");
    for (const publicNo of publicNumbers) {
      await expect(page.getByRole("checkbox", { name: new RegExp(publicNo) })).toBeChecked();
      await expect(feedback).toContainText(publicNo);
    }
    await expect(page.locator("body")).not.toContainText(sentinel);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`bulk-${failure}.png`),
      animations: "disabled",
    });
    await feedback.getByRole("button", { name: "重试失败工单" }).click();
    await expect(feedback).toHaveCount(0);
    expect(requests).toEqual([
      { ids, to: "diagnosing" },
      { ids, to: "diagnosing" },
    ]);
    expect(state.unexpectedMutations).toEqual([]);
  });
}

test("clears stale recovery when selection is cleared or the queue changes", async ({ page }) => {
  const state = await setup(page);
  await submit(page);
  const feedback = page.locator('[data-order-bulk-feedback="true"]');
  await expect(feedback).toBeVisible();
  await page.getByRole("button", { name: "清除选择", exact: true }).click();
  await expect(feedback).toHaveCount(0);
  for (const publicNo of publicNumbers) {
    await page.getByRole("checkbox", { name: new RegExp(publicNo) }).check();
  }
  await submit(page);
  await expect(feedback).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-order-queue-trigger="true"]').click();
  await page.getByRole("button", { name: /^待配件，\d+ 条工单$/ }).click();
  await expect(feedback).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除选择", exact: true })).toHaveCount(0);
  expect(state.unexpectedMutations).toEqual([]);
});

test("ignores an old batch response even after returning to the original queue", async ({
  page,
}) => {
  const state = await setup(page);
  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route(batchPath, async (route) => {
    await responseGate;
    await reply(route, 0, ids);
  });
  await submit(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const queue of ["ordered", "all"]) {
    await page.locator('[data-order-queue-trigger="true"]').click();
    await page.locator(`[data-order-queue-option="${queue}"]`).click();
    await expect(page.locator('[data-order-list-blocked="false"]')).toBeVisible();
  }
  const finished = page.waitForResponse((response) =>
    response.url().endsWith("/order/batch-transition"),
  );
  releaseResponse?.();
  await finished;
  await expect(page.locator('[data-order-bulk-feedback="true"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "清除选择", exact: true })).toHaveCount(0);
  expect(state.unexpectedMutations).toEqual([]);
});
