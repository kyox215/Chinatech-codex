import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
const evidence = "artifacts/orders-home-v2-release";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const captureLocalReads = process.env.REPAIRDESK_LOCAL_HAR_CAPTURE === "1";
test.use({
  contextOptions: captureLocalReads
    ? {
        locale: "zh-CN",
        recordHar: {
          path: `${evidence}/local-synthetic-reads.har`,
          urlFilter: /\/api\/repairdesk\//,
          content: "embed",
          mode: "full",
        },
      }
    : {},
});
test.skip(!enabled, "Use only the existing synthetic RepairDesk business fixture.");

async function overflow(page: Page) {
  const size = await page.evaluate(() => ({
    width: innerWidth,
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.screenshot({ path: `${evidence}/screenshots/${name}.png`, animations: "disabled" });
}

async function ready(page: Page, locale: string) {
  if (!captureLocalReads) {
    await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
  }
  await page.goto("/orders", { waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-order-mobile-card="true"], [data-order-row="true"]').first(),
  ).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test("final Chinese surfaces retain real order entry, details, filters and range", async ({
  page,
}) => {
  test.setTimeout(120_000);
  mkdirSync(`${evidence}/screenshots`, { recursive: true });
  const errors: string[] = [];
  const diagnostics: object[] = [];
  let stage = "list";
  page.on("pageerror", (error) => {
    errors.push(error.message);
    diagnostics.push({ stage, url: page.url(), message: error.message, stack: error.stack });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Runtime.enable");
  cdp.on("Runtime.exceptionThrown", (event) => diagnostics.push({ stage, ...event }));
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "zh-CN");
  const metrics: object[] = [];
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
    const rows = page.locator(
      width < 1024 ? '[data-order-mobile-card="true"]' : '[data-order-row="true"]',
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows.first().locator("[data-order-mini-progress-segment]")).toHaveCount(5);
    await overflow(page);
    metrics.push(
      await rows.evaluateAll((elements) => ({
        width: innerWidth,
        firstTop: elements[0].getBoundingClientRect().top,
        firstHeight: elements[0].getBoundingClientRect().height,
        fullyVisible: elements.filter((element) => {
          const r = element.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight;
        }).length,
      })),
    );
    await shot(page, `orders-zh-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  stage = "queue";
  const queueTrigger = page.locator('[data-order-queue-trigger="true"]');
  await queueTrigger.click();
  const queueDialog = page.getByRole("dialog", { name: "工作队列" });
  await expect(queueDialog.locator("[data-order-queue-option]")).toHaveCount(7);
  await expect(page.locator("input:focus, textarea:focus")).toHaveCount(0);
  await shot(page, "queue-zh-390");
  await page.keyboard.press("Escape");
  await expect(queueTrigger).toBeFocused();
  const range = page.locator('[data-order-range-trigger="true"]');
  stage = "range";
  await range.click();
  await expect(page.getByRole("dialog", { name: "订单显示范围" })).toBeVisible();
  await shot(page, "range-zh-390");
  await page
    .getByRole("group", { name: "订单显示范围" })
    .getByRole("button", { name: "全部", exact: true })
    .click();
  await expect(range).toContainText("全部");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-order-queue-trigger="true"]')).toHaveCount(0);
  await expect(page.locator('[data-order-static-results="true"]')).toBeVisible();
  await shot(page, "scope-all-static-390");
  await range.click();
  await page
    .getByRole("group", { name: "订单显示范围" })
    .getByRole("button", { name: "已归档", exact: true })
    .click();
  await expect(range).toContainText("已归档");
  await expect(page.locator('[data-order-static-results="true"]')).toBeVisible();
  await expect(page.locator('[data-order-queue-trigger="true"]')).toHaveCount(0);
  await shot(page, "scope-archive-static-390");
  await range.click();
  await page
    .getByRole("group", { name: "订单显示范围" })
    .getByRole("button", { name: "待处理", exact: true })
    .click();
  await expect(page.locator('[data-order-queue-trigger="true"]')).toBeVisible();
  await page.getByRole("button", { name: /^筛选订单/ }).click();
  stage = "filters";
  const filters = page.getByRole("dialog");
  await expect(filters).toContainText("工单类型");
  await expect(page.locator("input:focus, textarea:focus")).toHaveCount(0);
  await overflow(page);
  await shot(page, "filters-zh-390");
  await filters.getByRole("button", { name: "查看结果", exact: true }).click();
  await expect(filters).toHaveCount(0);
  await page.getByRole("button", { name: "新建工单", exact: true }).click();
  stage = "create";
  const create = page.locator('[data-new-order-dialog="true"]');
  await expect(create).toBeVisible();
  await expect(create.locator('[data-new-order-root="true"]')).toBeVisible();
  await overflow(page);
  await shot(page, "new-order-zh-390");
  await create.locator('[data-new-order-dialog-close="true"]').first().click();
  await expect(create).toHaveCount(0);
  await page.locator('[data-order-mobile-card="true"]').first().click();
  stage = "mobile-detail";
  await expect(page.locator('[data-order-detail-root="true"]')).toBeVisible();
  await expect(page).toHaveURL(/\/orders\//);
  await overflow(page);
  await shot(page, "detail-zh-390");
  await page.setViewportSize({ width: 1440, height: 960 });
  stage = "desktop-list";
  await ready(page, "zh-CN");
  await page.locator('[data-order-row="true"]').first().click();
  stage = "desktop-detail";
  const detail = page.locator('[data-order-detail-dialog-shell="true"]');
  await expect(detail).toBeVisible();
  await expect(detail.locator('[data-order-detail-root="true"]')).toBeVisible();
  await overflow(page);
  await shot(page, "detail-zh-1440");
  await detail.getByRole("button", { name: "关闭工单详情" }).first().click();
  await expect(detail).toHaveCount(0);
  writeFileSync(`${evidence}/browser-chinese.json`, JSON.stringify({ metrics, errors }, null, 2));
  writeFileSync(`${evidence}/browser-full-diagnostic.json`, JSON.stringify(diagnostics, null, 2));
  expect(errors).toEqual([]);
});

test("long Italian and redacted finance remain bounded across six widths", async ({ page }) => {
  test.setTimeout(90_000);
  mkdirSync(`${evidence}/screenshots`, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const order of body.data.list.items) {
      order.customer_name =
        "Cliente sintetico con nome estremamente lungo per verifica della leggibilità";
      order.device_label =
        "Samsung Galaxy S24 Ultra Titanium con descrizione dispositivo molto estesa";
      order.issue =
        "Verificare il connettore di alimentazione e il funzionamento del display dopo una caduta accidentale";
      order.finance_redacted = true;
    }
    await route.fulfill({ response, json: body });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "it-IT");
  for (const width of [390, 430, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
    const rows = page.locator(
      width < 1024 ? '[data-order-mobile-card="true"]' : '[data-order-row="true"]',
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).not.toContainText("€");
    await expect(rows.first()).not.toContainText("Display");
    await overflow(page);
    if (width < 1024) {
      const trigger = page.locator('[data-order-queue-trigger="true"]');
      await trigger.click();
      await expect(page.locator("[data-order-queue-option]")).toHaveCount(7);
      await overflow(page);
      if (width === 390) await shot(page, "queue-it-390");
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    if ([390, 430, 1440].includes(width)) await shot(page, `orders-it-long-redacted-${width}`);
  }
  expect(errors).toEqual([]);
  writeFileSync(
    `${evidence}/browser-italian.json`,
    JSON.stringify(
      { widths: [390, 430, 768, 1024, 1280, 1440], financeRedacted: true, errors },
      null,
      2,
    ),
  );
});

test("English search and type filters retain server results and a 44px clear target", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, "en");
  await expect(page.locator('[data-order-queue-trigger="true"]')).toContainText("All queues");
  const search = page.getByRole("textbox", { name: "Search order, customer, phone, or IMEI" });
  await search.fill("613800000822");
  await search.press("Enter");
  await expect(page.locator('[data-order-mobile-card="true"]')).toHaveCount(3);
  for (const card of await page.locator('[data-order-mobile-card="true"]').all()) {
    await expect(card).toContainText("+8613800000822");
  }
  await search.fill("");
  await search.press("Enter");
  await expect(page.locator('[data-order-mobile-card="true"]').nth(1)).toBeVisible();
  await page.getByRole("button", { name: /^Filter orders,/ }).click();
  const filters = page.getByRole("dialog", { name: "Filter repair orders" });
  await filters.getByRole("button", { name: "Quick repair", exact: true }).click();
  await filters.getByRole("button", { name: "View results", exact: true }).click();
  await expect(filters).toHaveCount(0);
  const clear = page.getByRole("button", { name: "Clear advanced filters", exact: true });
  await expect(clear).toBeVisible();
  expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await overflow(page);
  await shot(page, "orders-en-filtered-390");
  await clear.click();
  await expect(clear).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.locator('[data-order-row="true"]').first()).toBeVisible();
  await overflow(page);
});

test("financial review states remain visibly readable beside the mobile amounts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/repairdesk/orders/queue-summary", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.list.items = body.data.list.items.slice(0, 3).map((order: object, index: number) => ({
      ...order,
      approval_status: index === 2 ? "approved" : "rejected",
      approval_flow_status: index === 2 ? "approved" : "rejected",
      quotation_amount: 100,
      deposit_amount: index === 0 ? 0 : 20,
      balance_amount: index === 0 ? 100 : 80,
      payment_status: index === 0 ? "unpaid" : "partial",
      is_paid: false,
    }));
    await route.fulfill({ response, json: body });
  });
  await ready(page, "zh-CN");
  const states = page.locator('[data-order-financial-label="true"]');
  await expect(states).toHaveCount(3);
  for (const label of ["报价已拒绝", "报价已拒绝 · 款项待核对", "已付押金"]) {
    const state = states.filter({ hasText: new RegExp(`^${label}$`) });
    await expect(state).toBeVisible();
    expect((await state.boundingBox())?.height).toBeGreaterThan(8);
    expect(
      await state.evaluate((element) =>
        Boolean(element.closest('.sr-only, [hidden], [aria-hidden="true"]')),
      ),
    ).toBe(false);
  }
  await overflow(page);
  await shot(page, "financial-states-390");
});
