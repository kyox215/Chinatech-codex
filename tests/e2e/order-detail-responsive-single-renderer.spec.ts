import { expect, test, type Page } from "@playwright/test";

const enabled =
  process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1" ||
  process.env.REPAIRDESK_E2E_ORDER_AUDIT === "1";

test.skip(
  !enabled,
  "Set REPAIRDESK_E2E_BUSINESS_DESKTOP=1 or REPAIRDESK_E2E_ORDER_AUDIT=1 for responsive order detail checks.",
);

test.describe("order detail responsive single renderer", () => {
  for (const width of [390, 834]) {
    test(`uses one compact renderer at ${width}px`, async ({ page }) => {
      await gotoOrderDetail(page, width);
      await expectOrderDetailMode(page, "compact");

      await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toHaveCount(0);
      await expect(page.locator('[data-mobile-order-page="true"]')).toHaveCount(1);
      await expect(page.locator('[data-mobile-order-header="true"]')).toBeVisible();
      await expect(page.locator('[data-mobile-order-action-dock="true"]')).toBeVisible();
      await expect(page.locator('[data-app-bar="true"]')).toBeHidden();
      await expectNoPageOverflow(page);
    });
  }

  test("locks the compact renderer while widening across the breakpoint", async ({ page }) => {
    await gotoOrderDetail(page, 834);
    await expectOrderDetailMode(page, "compact");

    await page.setViewportSize({ width: 1024, height: 768 });
    await expectOrderDetailMode(page, "compact");
    await expect(page.locator('[data-mobile-order-header="true"]')).toBeVisible();
    await expect(page.locator('[data-mobile-order-action-dock="true"]')).toBeVisible();
    await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toHaveCount(0);
    await expect(page.locator('[data-app-bar="true"]')).toBeHidden();
    await expectNoPageOverflow(page);
  });

  test("locks the desktop renderer while narrowing below the breakpoint", async ({ page }) => {
    await gotoOrderDetail(page, 1024);
    await expectOrderDetailMode(page, "desktop");
    await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
    await expect(page.locator('[data-mobile-order-page="true"]')).toHaveCount(0);

    await page.setViewportSize({ width: 834, height: 768 });
    await expectOrderDetailMode(page, "desktop");
    await expect(page.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
    await expect(page.locator('[data-mobile-order-page="true"]')).toHaveCount(0);
    await expect(page.locator('[data-app-bar="true"]')).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("keeps dialog details on the desktop renderer", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/orders", { waitUntil: "domcontentloaded" });
    const firstRow = page
      .locator('[data-order-desktop-list="true"] [data-order-row="true"]')
      .first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    const detail = page.locator(
      '[data-order-detail-root="true"][data-order-detail-surface="dialog"]',
    );
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute("data-order-detail-render-mode", "desktop");
    await expect(page.locator('[data-order-detail-renderer="desktop"]')).toHaveCount(1);
    await expect(detail.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
    await expect(detail.locator('[data-mobile-order-page="true"]')).toHaveCount(0);
  });

  test("shows the compact skeleton navigation while a detail request is delayed", async ({
    page,
  }) => {
    let releaseOrderResponse!: () => void;
    const orderResponseGate = new Promise<void>((resolve) => {
      releaseOrderResponse = resolve;
    });
    await page.route("**/api/repairdesk/order/get", async (route) => {
      await orderResponseGate;
      await route.continue();
    });

    await page.setViewportSize({ width: 834, height: 768 });
    await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });

    const skeleton = page.locator('[data-ui="order-detail-skeleton"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator('[data-order-detail-skeleton-nav="true"]')).toHaveCount(1);
    await expect(skeleton.getByRole("link", { name: "返回工单列表" })).toBeVisible();
    await expect(page.locator('[data-app-bar="true"]')).toBeHidden();
    await expect(page.locator('[data-order-detail-root="true"]')).toHaveCount(0);

    releaseOrderResponse();
    await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
    await expectOrderDetailMode(page, "compact");
    await expect(skeleton).toHaveCount(0);
  });

  test("preserves a compact draft and focus while widening without mutations", async ({ page }) => {
    const mutationCount = await installOrderMutationGuard(page);
    await gotoOrderDetail(page, 834);

    const detail = page.locator('[data-order-detail-root="true"]');
    const quote = detail.locator("#mobile-order-quote");
    await expect(quote).toBeVisible();
    await quote.getByRole("button", { name: "编辑", exact: true }).click();

    let projectInput = quote.locator('input[placeholder="项目"]').first();
    if ((await projectInput.count()) === 0) {
      await quote.getByRole("button", { name: /添加自定义项目/ }).click();
      projectInput = quote.locator('input[placeholder="项目"]').first();
    }
    await expect(projectInput).toBeVisible();
    const marker = "compact-resize-draft";
    await projectInput.fill(marker);
    await projectInput.focus();
    await expect(projectInput).toBeFocused();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expectOrderDetailMode(page, "compact");
    await expect(projectInput).toHaveValue(marker);
    await expect(quote.getByRole("button", { name: "收起", exact: true })).toBeVisible();
    await expect(projectInput).toBeFocused();
    expect(mutationCount()).toBe(0);
  });

  test("preserves a desktop draft and focus while narrowing without mutations", async ({
    page,
  }) => {
    const mutationCount = await installOrderMutationGuard(page);
    await gotoOrderDetail(page, 1024);

    const detail = page.locator('[data-order-detail-root="true"]');
    await detail.getByRole("button", { name: "编辑", exact: true }).click();
    const customerInput = detail.locator('input[aria-label="客户"]').first();
    await expect(customerInput).toBeVisible();
    const marker = "desktop-resize-draft";
    await customerInput.fill(marker);
    await customerInput.focus();
    await expect(customerInput).toBeFocused();

    await page.setViewportSize({ width: 834, height: 768 });
    await expectOrderDetailMode(page, "desktop");
    await expect(customerInput).toHaveValue(marker);
    await expect(detail.getByRole("button", { name: "保存", exact: true })).toBeVisible();
    await expect(customerInput).toBeFocused();
    expect(mutationCount()).toBe(0);
  });
});

async function gotoOrderDetail(page: Page, width: number) {
  await page.setViewportSize({ width, height: 768 });
  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
}

async function expectOrderDetailMode(page: Page, mode: "compact" | "desktop") {
  const detail = page.locator('[data-order-detail-root="true"]');
  await expect(detail).toHaveAttribute("data-order-detail-render-mode", mode);
  await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
  await expect(page.locator(`[data-order-detail-renderer="${mode}"]`)).toHaveCount(1);
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

async function installOrderMutationGuard(page: Page) {
  let mutationCount = 0;
  await page.route("**/api/repairdesk/order/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const isMutation =
      request.method() !== "GET" &&
      /\/api\/repairdesk\/order\/(?:patch|finance|transition|custody|payment|notification|whatsapp-notification|approval-request|approval-decision|attachment\/upload|update|publish-quote|confirm-quote-sent|correct-terminal|reopen|void)(?:$|\/)/.test(
        path,
      );
    if (isMutation) {
      mutationCount += 1;
      await route.abort();
      return;
    }
    await route.continue();
  });
  return () => mutationCount;
}
