import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { resolve } from "node:path";

import type { AppLocale } from "@/shared/i18n/locales";
import { localeDisplayNames } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (!enabled) {
  throw new Error("Release 2B-4 i18n checks require REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseURL).origin;
const locales = ["zh-CN", "it-IT", "en"] as const;
const widths = [390, 430, 768, 1024, 1280, 1440] as const;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const synthetic = {
  productId: "product_release_2b4",
  brand: "动态品牌 Ω",
  model: "Modello 客制 Ω",
  sku: "SKU-DYNAMIC-动态-001",
  location: "库位 DYNAMIC-Ω",
  notes: "动态商品备注 Ω",
  specification: "Spec DYNAMIC-客制",
  color: "Colore DYNAMIC-朱红",
  network: "EU DYNAMIC-双卡",
  customerId: "customer_release_2b4",
  customer: "动态客户 Ω",
  phone: "+39••••1122",
  issue: "动态售后问题 Ω",
  diagnosis: "动态检测结论 Ω",
  paymentNote: "动态付款备注 Ω",
  unknownStatus: "future_custom_status_Ω",
} as const;

type RouteKind =
  | "list"
  | "new"
  | "detail"
  | "edit"
  | "reserve"
  | "sell"
  | "reservation"
  | "sale"
  | "after-sales"
  | "after-sales-case";

const routeCases: ReadonlyArray<{ kind: RouteKind; path: string }> = [
  { kind: "list", path: "/inventory" },
  { kind: "new", path: "/inventory/new" },
  { kind: "detail", path: `/inventory/${synthetic.productId}` },
  { kind: "edit", path: `/inventory/${synthetic.productId}/edit` },
  { kind: "reserve", path: `/inventory/${synthetic.productId}/reserve` },
  { kind: "sell", path: `/inventory/${synthetic.productId}/sell` },
  { kind: "reservation", path: "/inventory/reservations/reservation_release_2b4" },
  { kind: "sale", path: "/inventory/sales/sale_release_2b4" },
  { kind: "after-sales", path: "/inventory/after-sales" },
  { kind: "after-sales-case", path: "/inventory/after-sales/case_release_2b4" },
];

const pagePaths = new Set(routeCases.map(({ path }) => path));
const readPosts = new Set([
  "/api/repairdesk/inventory/products/list",
  "/api/repairdesk/inventory/products/get",
  "/api/repairdesk/inventory/products/edit-data",
  "/api/repairdesk/inventory/catalog/search",
  "/api/repairdesk/inventory/summary",
  "/api/repairdesk/inventory/lifecycle/summary",
  "/api/repairdesk/inventory/lifecycle/sale",
  "/api/repairdesk/inventory/lifecycle/after-sales",
  "/api/repairdesk/inventory/lifecycle/after-sales/case",
  "/api/repairdesk/customers/search",
  "/api/repairdesk/customers/list-page",
  "/api/repairdesk/orders/queue-summary",
]);
const readGets = new Set([
  "/api/repairdesk/shell/bootstrap",
  "/api/repairdesk/settings/store",
  "/api/repairdesk/order-workflow",
  "/api/repairdesk/options",
  "/api/repairdesk/kiosk/available-devices",
]);

type Evidence = {
  page: Page;
  pageErrors: string[];
  consoleMessages: string[];
  forbiddenRequests: string[];
  allowedReads: string[];
  localWrites: string[];
  externalWrites: string[];
};

type FixtureState = "ready" | "loading" | "permission" | "error" | "empty";

test.describe.configure({ retries: 0 });

for (const locale of locales) {
  for (const width of widths) {
    test(`inventory routes ${locale} ${width}px`, async ({ page }, testInfo) => {
      const control: FixtureControl = {
        locale,
        width,
        state: "ready",
        routeKind: "list",
        pendingCustomerSearch: [],
        pendingAfterSales: [],
      };
      const evidence = await preparePage(page, locale, control);
      const externalProbes: string[] = [];
      await page.setViewportSize({ width, height: viewportHeight(width) });

      for (const routeCase of routeCases) {
        control.state = fixtureState(routeCase.kind, locale, width);
        control.routeKind = routeCase.kind;
        control.pendingCustomerSearch = [];
        control.pendingAfterSales = [];
        const readsBeforeRoute = evidence.allowedReads.length;
        await page.goto(routeCase.path, { waitUntil: "domcontentloaded" });

        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const root = await expectRoutePresentation(page, routeCase.kind, locale, control.state);
        await expectCompleteLifecycleDesktopTitle(page, routeCase.kind, locale, width);
        await expectQuickEntryActionDock(root, routeCase.kind, locale, width);
        await expectNoHorizontalOverflow(page);
        if (control.state === "permission") {
          expect(
            evidence.allowedReads
              .slice(readsBeforeRoute)
              .filter((entry) =>
                /\/api\/repairdesk\/inventory\/(?:products|lifecycle)\//u.test(entry),
              ),
          ).toEqual([]);
        }

        if (control.state === "ready") {
          await expectDynamicFidelity(root, routeCase.kind);
          await exerciseRouteInteraction(
            page,
            root,
            routeCase.kind,
            locale,
            width,
            control.pendingCustomerSearch,
          );
        }
        await expectNoUnexpectedFixedHan(root, locale);

        const externalProbe =
          routeCase.kind === "list" && locale === "zh-CN" && width === 390
            ? "https://release2b4.invalid/api/repairdesk/inventory/products/update"
            : undefined;
        if (externalProbe) {
          await probeBlockedExternalWrite(page, externalProbe);
          externalProbes.push(`POST ${externalProbe}`);
        }

        await saveEvidenceScreenshot(
          page,
          testInfo,
          `${routeCase.kind}-${locale}-${width}-${control.state}`,
        );
        await assertEvidence(evidence, externalProbes);

        if (control.pendingAfterSales[0]) {
          await control.pendingAfterSales[0].fulfill({ json: { data: [] } });
        }
      }
    });
  }
}

test("heavy en 1440px preserves Quick Entry draft through real AppBar locale switches", async ({
  page,
}, testInfo) => {
  const createBodies: Array<Record<string, unknown>> = [];
  const createRoutes: Route[] = [];
  const updateBodies: Array<Record<string, unknown>> = [];
  const updateRoutes: Route[] = [];
  await page.route(apiUrl("inventory/products/quick-create"), (route) => {
    createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    createRoutes.push(route);
  });
  await page.route(apiUrl("inventory/products/update"), (route) => {
    updateBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    updateRoutes.push(route);
  });
  const control: FixtureControl = {
    locale: "en",
    width: 1440,
    state: "ready",
    routeKind: "new",
    pendingCustomerSearch: [],
    pendingAfterSales: [],
  };
  const evidence = await preparePage(page, "en", control, [
    "POST /api/repairdesk/inventory/products/quick-create",
    "POST /api/repairdesk/inventory/products/update",
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory/new", { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-inventory-product-page-frame="intake"]');
  await expect(root).toBeVisible();
  const brand = root.locator("#product-brand");
  const model = root.locator("#product-model");
  await brand.fill("Apple");
  await model.fill("iPhone 15 Pro");
  await expect(root).toContainText(
    translateMessage("en", "inventory2b4.quick.colorPolicy.pending"),
  );
  await model.fill("Future Apple Model Ω");
  await expect(root).toContainText(
    translateMessage("en", "inventory2b4.quick.colorPolicy.pending"),
  );

  await model.focus();
  await page.evaluate(() => window.scrollTo(0, 20));
  const startingScroll = await page.evaluate(() => window.scrollY);
  const readsBeforeSwitch = evidence.allowedReads.length;
  await switchLocale(page, "it-IT");
  await switchLocale(page, "en");
  await expect(page).toHaveURL(`${baseOrigin}/inventory/new`);
  await expect(brand).toHaveValue("Apple");
  await expect(model).toHaveValue("Future Apple Model Ω");
  expect(await page.evaluate(() => window.scrollY)).toBe(startingScroll);
  expect(evidence.allowedReads).toHaveLength(readsBeforeSwitch);

  await root
    .getByRole("button", {
      name: translateMessage("en", "inventory2b4.quick.screen.saveAndView"),
    })
    .click();
  await expect(root.getByRole("alert")).toContainText(
    translateMessage("en", "inventory2b4.quick.validation.imei1Required"),
  );
  expect(evidence.localWrites).toEqual([]);
  await root.locator("#product-imei1").fill("000000000000000");
  await page.evaluate(() =>
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false }),
  );
  await root
    .getByRole("button", {
      name: translateMessage("en", "inventory2b4.quick.screen.saveAndView"),
    })
    .click();
  await expect(root.getByRole("alert")).toContainText(
    translateMessage("en", "inventory2b4.quick.screen.offline"),
  );
  expect(evidence.localWrites).toEqual([]);
  await root.locator("#product-imei1").fill("");
  expect(
    await root
      .locator("input")
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
  ).not.toContain("000000000000000");
  await expectNoUnexpectedFixedHan(root, "en");
  await saveEvidenceScreenshot(page, testInfo, "heavy-new-en-1440-locale-draft-validation");
  await assertEvidence(evidence, []);

  await page.evaluate(() =>
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true }),
  );
  await root.locator("#product-imei1").fill("000000000000000");
  const createButton = root.getByRole("button", {
    name: translateMessage("en", "inventory2b4.quick.screen.saveAndView"),
  });
  await createButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => createBodies.length).toBe(1);
  const createBody = createBodies[0]!;
  const createInput = (createBody.input ?? {}) as Record<string, unknown>;
  expect(createInput.idempotency_key).toMatch(UUID_V4);
  expect({ ...createBody, input: { ...createInput, idempotency_key: "<uuid>" } }).toEqual({
    input: {
      idempotency_key: "<uuid>",
      category: "phone",
      brand: "Apple",
      model: "Future Apple Model Ω",
      specifications: {},
      identifiers: [
        {
          kind: "imei1",
          value: "000000000000000",
          source: "manual",
          primary: true,
        },
      ],
    },
  });
  await createRoutes[0]!.fulfill({
    json: { data: { id: synthetic.productId, sku: synthetic.sku } },
  });
  await page.waitForURL(`${baseOrigin}/inventory/${synthetic.productId}`);

  control.routeKind = "edit";
  await page.goto(`/inventory/${synthetic.productId}/edit`, { waitUntil: "domcontentloaded" });
  const editRoot = page.locator('[data-inventory-product-page-frame="edit"]');
  await expect(editRoot).toBeVisible();
  await editRoot.locator("#product-notes").fill(`${synthetic.notes} UPDATED`);
  const updateButton = editRoot.getByRole("button", {
    name: translateMessage("en", "inventory2b4.quick.edit.save"),
  });
  await updateButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => updateBodies.length).toBe(1);
  const updateBody = updateBodies[0]!;
  const updateInput = (updateBody.input ?? {}) as Record<string, unknown>;
  expect(updateInput.idempotency_key).toMatch(UUID_V4);
  expect({ ...updateBody, input: { ...updateInput, idempotency_key: "<uuid>" } }).toEqual({
    id: synthetic.productId,
    input: {
      idempotency_key: "<uuid>",
      category: "phone",
      brand: synthetic.brand,
      model: synthetic.model,
      color: synthetic.color,
      ram_capacity: "8 GB",
      storage_capacity: "256 GB",
      gtin: "4006381333931",
      condition: "A",
      specifications: { network_variant: synthetic.network, edition: "Edition Ω" },
      identifiers: [
        {
          kind: "imei1",
          value: "000000000000000",
          source: "manual",
          primary: true,
        },
      ],
      list_price: 899,
      cost_amount: 987654.32,
      location: synthetic.location,
      warranty_months: 12,
      notes: `${synthetic.notes} UPDATED`,
      expected_version: 7,
    },
  });
  await updateRoutes[0]!.fulfill({
    json: { data: { ok: true, code: "updated", id: synthetic.productId, version: 8 } },
  });
  await page.waitForURL(`${baseOrigin}/inventory/${synthetic.productId}`);
  expect(createBodies).toHaveLength(1);
  expect(updateBodies).toHaveLength(1);
  await saveEvidenceScreenshot(page, testInfo, "heavy-products-en-1440-create-update-complete");
  await assertEvidence(
    evidence,
    [],
    [
      "POST /api/repairdesk/inventory/products/quick-create",
      "POST /api/repairdesk/inventory/products/update",
    ],
  );
});

test("heavy zh-CN 1440px sends one exact staged reservation.create and never sale.complete", async ({
  page,
}, testInfo) => {
  const commandBodies: Array<Record<string, unknown>> = [];
  const commandRoutes: Route[] = [];
  await page.route(apiUrl("inventory/lifecycle/command"), async (route) => {
    commandBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    commandRoutes.push(route);
  });
  const control: FixtureControl = {
    locale: "zh-CN",
    width: 1440,
    state: "ready",
    routeKind: "sell",
    pendingCustomerSearch: [],
    pendingAfterSales: [],
  };
  const evidence = await preparePage(page, "zh-CN", control, [
    "POST /api/repairdesk/inventory/lifecycle/command",
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/inventory/${synthetic.productId}/sell`, { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-ui="inventory-lifecycle-page"]');
  await expect(root).toContainText(
    translateMessage("zh-CN", "inventory2b4.reservation.saleDescription"),
  );
  const customer = root.getByRole("combobox", {
    name: new RegExp(escapeRegExp(translateMessage("zh-CN", "inventory2b4.reservation.customer"))),
  });
  await customer.fill("Dynamic");
  await expect(root).toContainText(
    translateMessage("zh-CN", "inventory2b4.reservation.customerLoading"),
  );
  await expect.poll(() => control.pendingCustomerSearch.length).toBe(1);
  await control.pendingCustomerSearch[0]!.fulfill({ json: { data: [customerFixture()] } });
  await page.getByRole("option", { name: new RegExp(escapeRegExp(synthetic.customer)) }).click();
  await root
    .getByRole("textbox", {
      name: new RegExp(
        escapeRegExp(translateMessage("zh-CN", "inventory2b4.reservation.noDepositReason")),
      ),
    })
    .fill("CANONICAL NO DEPOSIT");
  await root.locator("#reservation-expires").fill("2099-08-20T12:00");
  await root.locator("#reservation-pickup").fill("2099-08-15T12:00");
  await root
    .getByRole("button", {
      name: translateMessage("zh-CN", "inventory2b4.reservation.submit"),
    })
    .click();
  await expect.poll(() => commandBodies.length).toBe(1);
  await expect(root).toContainText(translateMessage("zh-CN", "inventory2b4.reservation.pending"));
  const commandBody = commandBodies[0]!;
  expect(commandBody.idempotency_key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect({ ...commandBody, idempotency_key: "<uuid>" }).toEqual({
    command: "reservation.create",
    idempotency_key: "<uuid>",
    payload: {
      stock_unit_id: "stock_unit_release_2b4",
      expected_unit_version: 7,
      agreed_price: 899,
      customer_id: synthetic.customerId,
      no_deposit_reason: "CANONICAL NO DEPOSIT",
      expires_at: "2099-08-20T10:00:00.000Z",
      expected_pickup_at: "2099-08-15T10:00:00.000Z",
    },
  });
  expect(commandBodies.some((body) => body.command === "sale.complete")).toBe(false);
  await expect(root).not.toContainText("+393330001122");
  await expect(root).toContainText("1122");
  const blockedExternal = "https://release2b4.invalid/api/repairdesk/inventory/lifecycle/command";
  await probeBlockedExternalWrite(page, blockedExternal);
  await saveEvidenceScreenshot(page, testInfo, "heavy-sell-zh-CN-1440-staged-pending");
  await assertEvidence(
    evidence,
    [`POST ${blockedExternal}`],
    ["POST /api/repairdesk/inventory/lifecycle/command"],
  );

  await commandRoutes[0]!.fulfill({
    json: { data: { ok: true, code: "created", sale_order_id: "sale_release_2b4" } },
  });
  await page.waitForURL(`${baseOrigin}/inventory/sales/sale_release_2b4`);
  const saleRoot = page.locator('[data-ui="inventory-lifecycle-page"]');
  const paymentInput = saleRoot.locator("#inventory-sale-payment-amount");
  const paymentSection = paymentInput.locator("xpath=ancestor::section[1]");
  const paymentButton = saleRoot.getByRole("button", {
    name: translateMessage("zh-CN", "inventory2b4.sale.payment.confirm", {
      amount: new Intl.NumberFormat("zh-CN", { style: "currency", currency: "EUR" }).format(799),
    }),
  });
  await expect(paymentButton).toBeEnabled();
  await paymentButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect.poll(() => commandBodies.length).toBe(2);
  await expect(paymentSection).toContainText(
    translateMessage("zh-CN", "inventory2b4.sale.payment.pending"),
  );
  expectLifecycleCommand(commandBodies[1]!, "payment.append", {
    sale_order_id: "sale_release_2b4",
    expected_order_version: 11,
    kind: "payment",
    amount: 799,
    method: "cash",
  });
  await commandRoutes[1]!.fulfill({
    status: 200,
    headers: { "x-repairdesk-test-status": "409" },
    json: { error: "RAW-CONFLICT-SECRET-SENTINEL", code: "stale_version" },
  });
  const conflictPanel = saleRoot.locator('[data-ui="inventory-conflict-panel"]');
  await expect(conflictPanel).toContainText(
    translateMessage("zh-CN", "inventory2b4.conflict.version.title"),
  );
  await expect(saleRoot).not.toContainText("RAW-CONFLICT-SECRET-SENTINEL");
  await conflictPanel
    .getByRole("button", { name: translateMessage("zh-CN", "inventory2b4.conflict.refresh") })
    .click();
  await expect(conflictPanel).toBeHidden();
  expect(commandBodies).toHaveLength(2);

  await paymentButton.click();
  await expect.poll(() => commandBodies.length).toBe(3);
  expectLifecycleCommand(commandBodies[2]!, "payment.append", {
    sale_order_id: "sale_release_2b4",
    expected_order_version: 11,
    kind: "payment",
    amount: 799,
    method: "cash",
  });
  expect(commandBodies[2]!.idempotency_key).not.toBe(commandBodies[1]!.idempotency_key);
  await commandRoutes[2]!.fulfill({
    status: 200,
    headers: { "x-repairdesk-test-status": "503" },
    json: { error: "RAW-OUTCOME-SECRET-SENTINEL", code: "provider_unavailable" },
  });
  const operationPanel = saleRoot.locator('[data-ui="inventory-operation-error-panel"]');
  await expect(operationPanel).toContainText(
    translateMessage("zh-CN", "inventory2b4.operationError.unknown.title"),
  );
  await expect(saleRoot).not.toContainText("RAW-OUTCOME-SECRET-SENTINEL");
  await operationPanel
    .getByRole("button", { name: translateMessage("zh-CN", "inventory2b4.operationError.verify") })
    .click();
  await operationPanel
    .getByRole("button", {
      name: translateMessage("zh-CN", "inventory2b4.operationError.acknowledge"),
    })
    .click();
  await expect(operationPanel).toBeHidden();
  expect(commandBodies).toHaveLength(3);

  await paymentButton.click();
  await expect.poll(() => commandBodies.length).toBe(4);
  expectLifecycleCommand(commandBodies[3]!, "payment.append", {
    sale_order_id: "sale_release_2b4",
    expected_order_version: 11,
    kind: "payment",
    amount: 799,
    method: "cash",
  });
  expect(commandBodies[3]!.idempotency_key).not.toBe(commandBodies[2]!.idempotency_key);
  control.saleReadFailure = true;
  await commandRoutes[3]!.fulfill({
    json: { data: { ok: true, code: "idempotent_replay" } },
  });
  const receipt = saleRoot.locator('[data-ui="inventory-operation-receipt-panel"]');
  await expect(receipt).toHaveAttribute("data-operation-receipt-kind", "idempotent-replay");
  const syncPanel = saleRoot.locator('[data-ui="inventory-sync-status-panel"]');
  await expect(syncPanel).toHaveAttribute("data-sync-status", "committed-refresh-failed");
  await expect(syncPanel).toContainText(
    translateMessage("zh-CN", "inventory2b4.sync.failed.title"),
  );
  await expect(saleRoot).not.toContainText("RAW-SALE-READ-SECRET-SENTINEL");
  await saveEvidenceScreenshot(page, testInfo, "heavy-sale-zh-CN-1440-replay-sync-failed");
  control.saleReadFailure = false;
  await syncPanel
    .getByRole("button", { name: translateMessage("zh-CN", "inventory2b4.sync.retry") })
    .click();
  await expect(syncPanel).toHaveAttribute("data-sync-status", "recovered");
  expect(commandBodies).toHaveLength(4);
  await assertEvidence(
    evidence,
    [`POST ${blockedExternal}`],
    Array.from({ length: 4 }, () => "POST /api/repairdesk/inventory/lifecycle/command"),
  );
});

function fixtureState(kind: RouteKind, locale: AppLocale, width: number): FixtureState {
  if (kind !== "after-sales") return "ready";
  if (locale === "zh-CN" && width === 430) return "loading";
  if (locale === "it-IT" && width === 768) return "permission";
  if (locale === "en" && width === 1024) return "error";
  if (locale === "zh-CN" && width === 1280) return "empty";
  return "ready";
}

type FixtureControl = {
  locale: AppLocale;
  width: number;
  state: FixtureState;
  routeKind: RouteKind;
  pendingCustomerSearch: Route[];
  pendingAfterSales: Route[];
  saleReadFailure?: boolean;
};

async function preparePage(
  page: Page,
  locale: AppLocale,
  control: FixtureControl,
  allowedWrites: string[] = [],
) {
  await page.context().addCookies([
    {
      name: "repairdesk_locale",
      value: locale,
      url: baseURL,
      sameSite: "Lax",
    },
  ]);
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __release2b4Document?: string;
      __release2b4Unhandled?: string[];
    };
    state.__release2b4Document = "same-document";
    state.__release2b4Unhandled = [];
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "2g", saveData: true },
    });
    window.addEventListener("unhandledrejection", (event) => {
      state.__release2b4Unhandled?.push(String(event.reason));
    });
  });
  await installSyntheticHttpStatusBridge(page);
  await installInventoryFixtures(page, control);
  return installStrictGate(page, allowedWrites);
}

async function installSyntheticHttpStatusBridge(page: Page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const status = Number(response.headers.get("x-repairdesk-test-status"));
      if (!Number.isInteger(status) || status < 400) return response;
      return new Response(await response.blob(), {
        status,
        statusText: "Synthetic intercepted API failure",
        headers: response.headers,
      });
    };
  });
}

async function installInventoryFixtures(page: Page, options: FixtureControl) {
  await page.route(apiUrl("shell/bootstrap"), (route) =>
    route.fulfill({ json: { data: shellBootstrapFixture(options) } }),
  );
  await page.route(apiUrl("order-workflow"), (route) =>
    route.fulfill({
      json: { data: { statuses: [], transitions: [] } },
    }),
  );
  await page.route(apiUrl("customers/list-page"), (route) =>
    route.fulfill({
      json: {
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 30,
          pageCount: 0,
          tags: [],
          stats: {
            total: 0,
            repeat: 0,
            activeRepairs: 0,
            unpaid: 0,
            financeRedacted: true,
            withDevices: 0,
            dueFollowups: 0,
            marketable: 0,
          },
        },
      },
    }),
  );
  await page.route(apiUrl("orders/queue-summary"), (route) =>
    route.fulfill({
      json: {
        data: {
          list: { items: [], total: 0, page: 1, pageSize: 20, pageCount: 0 },
          workflow: { statuses: [], transitions: [] },
          options: {
            suppliers: [],
            technicians: [],
            permissions: {
              canReadSuppliers: false,
              canAssignSuppliers: false,
              canManageSuppliers: false,
            },
          },
        },
      },
    }),
  );
  await page.route(apiUrl("inventory/summary"), (route) =>
    route.fulfill({
      json: {
        data: {
          totalItems: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalValue: 0,
          categories: [],
        },
      },
    }),
  );

  await page.route(apiUrl("inventory/products/list"), (route) =>
    route.fulfill({ json: { data: productListFixture() } }),
  );
  await page.route(apiUrl("inventory/products/get"), (route) =>
    route.fulfill({ json: { data: productFixture(options) } }),
  );
  await page.route(apiUrl("inventory/products/edit-data"), (route) =>
    route.fulfill({ json: { data: productEditFixture(options) } }),
  );
  await page.route(apiUrl("inventory/catalog/search"), (route) =>
    route.fulfill({ json: { data: { items: [] } } }),
  );
  await page.route(apiUrl("inventory/lifecycle/summary"), (route) =>
    route.fulfill({ json: { data: lifecycleSummaryFixture() } }),
  );
  await page.route(apiUrl("inventory/lifecycle/sale"), (route) => {
    if (options.saleReadFailure) {
      return route.fulfill({
        status: 200,
        headers: { "x-repairdesk-test-status": "500" },
        json: { error: "RAW-SALE-READ-SECRET-SENTINEL" },
      });
    }
    return route.fulfill({ json: { data: saleFixture() } });
  });
  await page.route(apiUrl("inventory/lifecycle/after-sales/case"), (route) =>
    route.fulfill({ json: { data: afterSalesCaseFixture() } }),
  );
  await page.route(apiUrl("inventory/lifecycle/after-sales"), async (route) => {
    if (options.routeKind === "after-sales" && options.state === "loading") {
      options.pendingAfterSales.push(route);
      return;
    }
    if (options.routeKind === "after-sales" && options.state === "error") {
      await route.fulfill({
        status: 200,
        headers: { "x-repairdesk-test-status": "500" },
        json: { error: "RAW-INVENTORY-SECRET-SENTINEL" },
      });
      return;
    }
    await route.fulfill({
      json: {
        data:
          options.routeKind === "after-sales" && options.state === "empty"
            ? []
            : [afterSalesQueueFixture()],
      },
    });
  });
  await page.route(apiUrl("customers/search"), async (route) => {
    if (
      (options.routeKind === "reserve" || options.routeKind === "sell") &&
      options.state === "ready" &&
      options.pendingCustomerSearch.length === 0
    ) {
      options.pendingCustomerSearch.push(route);
      return;
    }
    await route.fulfill({ json: { data: [customerFixture()] } });
  });
}

function productFixture(control?: FixtureControl) {
  const costAllowed = !(
    control?.routeKind === "detail" &&
    control.locale === "en" &&
    control.width === 768
  );
  return {
    id: synthetic.productId,
    sku: synthetic.sku,
    category: "phone",
    brand: synthetic.brand,
    model: synthetic.model,
    specification: synthetic.specification,
    masked_identifier: "•••• 2345",
    status: "in_stock",
    location: synthetic.location,
    list_price: 899,
    ...(costAllowed ? { cost_amount: 987654.32 } : {}),
    currency_code: "EUR",
    updated_at: "2026-10-25T01:30:00.000Z",
    created_at: "2026-10-24T08:00:00.000Z",
    color: synthetic.color,
    ram_capacity: "8 GB",
    storage_capacity: "256 GB",
    gtin: "0195949012345",
    condition: "A",
    specifications: { network_variant: synthetic.network, edition: "Edition Ω" },
    identifiers: [
      { kind: "imei1", masked_value: "•••• 2345", primary: true },
      { kind: "serial", masked_value: "•••• AB9C", primary: false },
    ],
    warranty_months: 12,
    notes: synthetic.notes,
    inspection: {
      id: "inspection_release_2b4",
      battery_health: 92,
      face_id_status: "passed",
      inspected_at: "2026-10-25T01:30:00.000Z",
    },
    version: 7,
  };
}

function productEditFixture(control?: FixtureControl) {
  return {
    ...productFixture(control),
    gtin: "4006381333931",
    identifiers: [
      {
        kind: "imei1",
        value: "000000000000000",
        source: "manual",
        primary: true,
      },
    ],
  };
}

function productListFixture() {
  return {
    items: [
      {
        ...productFixture(),
        lifecycle: {
          mode: "exact",
          status: "in_stock",
          confidence: "high",
          needs_review: false,
          allowed_actions: ["reservation.create"],
        },
      },
    ],
    total: 1,
    facets: { brands: [synthetic.brand], locations: [synthetic.location] },
    lifecycle_projection: { mode: "exact", counts: { in_stock: 1 } },
  };
}

function lifecycleSummaryFixture() {
  return {
    item_id: synthetic.productId,
    stock_unit_id: "stock_unit_release_2b4",
    sku: synthetic.sku,
    business_status: "in_stock",
    unit_version: 7,
    allowed_actions: ["reservation.create"],
    projection: {
      mode: "exact",
      status: "in_stock",
      confidence: "high",
      needs_review: false,
      allowed_actions: ["reservation.create"],
    },
  };
}

function saleFixture() {
  return {
    item_id: synthetic.productId,
    stock_unit_id: "stock_unit_release_2b4",
    sku: synthetic.sku,
    business_status: "reserved",
    unit_version: 7,
    order_version: 11,
    sale_order_id: "sale_release_2b4",
    inventory_item_id: synthetic.productId,
    status: "reserved",
    agreed_price: 899,
    signed_paid_amount: 100,
    balance: 799,
    expected_pickup_at: "2026-10-25T01:30:00.000Z",
    payments: [
      {
        kind: "deposit",
        amount: 100,
        method: "cash",
        occurred_at: "2026-10-24T08:00:00.000Z",
      },
    ],
    allowed_actions: ["payment.append", "reservation.cancel"],
    projection: {
      mode: "exact",
      status: "reserved",
      confidence: "high",
      needs_review: false,
      balance: 799,
      expected_pickup_at: "2026-10-25T01:30:00.000Z",
      allowed_actions: ["payment.append", "reservation.cancel"],
    },
  };
}

function afterSalesQueueFixture() {
  return {
    case_id: "case_release_2b4",
    sale_order_id: "sale_release_2b4",
    inventory_item_id: synthetic.productId,
    stock_unit_id: "stock_unit_release_2b4",
    sku: synthetic.sku,
    status: "open",
    issue_summary: synthetic.issue,
    received_at: "2026-10-25T01:30:00.000Z",
    version: 3,
    order_version: 11,
    allowed_actions: ["after_sales.update"],
    allowed_next_statuses: [synthetic.unknownStatus],
  };
}

function afterSalesCaseFixture() {
  return {
    ...afterSalesQueueFixture(),
    status: synthetic.unknownStatus,
    diagnosis: synthetic.diagnosis,
    coverage_decision: "future_coverage_Ω",
    events: [
      {
        id: "event_release_2b4",
        event_type: "future_event_Ω",
        from_status: "open",
        to_status: synthetic.unknownStatus,
        created_at: "2026-10-25T01:30:00.000Z",
      },
    ],
  };
}

function customerFixture() {
  return {
    id: synthetic.customerId,
    name: synthetic.customer,
    phone_e164: "+393330001122",
  };
}

function shellBootstrapFixture(control: FixtureControl) {
  const activeStore = {
    id: "store_release_2b4",
    name: "Synthetic Repair Store",
    slug: "synthetic-release-2b4",
    role: "owner",
    status: "active",
    membershipId: "membership_release_2b4",
  };
  const costAllowed = !(
    control.routeKind === "detail" &&
    control.locale === "en" &&
    control.width === 768
  );
  return {
    onboarding: {
      userId: "user_release_2b4",
      displayName: "Synthetic Operator",
      isPlatformAdmin: false,
      activeStore,
      stores: [activeStore],
      requests: [],
      availableStores: [],
    },
    storeContext: {
      activeStore,
      stores: [activeStore],
      activeStoreExplicit: true,
      permissions: {
        canReadSuppliers: false,
        canAssignSuppliers: false,
        canManageSuppliers: false,
        canReadInventory: control.state !== "permission",
        canCreateInventory: true,
        canUpdateInventory: true,
        canSellInventory: true,
        canAllocateInventoryCosts: costAllowed,
        inventoryProductsUiEnabled: true,
        inventoryProductQuickCreateEnabled: true,
        inventoryLifecycleUiEnabled: true,
        inventoryProductInspectionEnabled: true,
        canInspectInventory: true,
        canReadAggregateFinance: false,
      },
    },
    aiCapabilities: {
      canUseOrderAssistant: false,
      canUseOrderInlineActions: false,
      canUseVisionIntake: false,
      canApplyInventoryDraft: false,
      reason: "feature_off",
    },
    generatedAt: "2026-09-03T08:00:00.000Z",
  };
}

async function expectRoutePresentation(
  page: Page,
  kind: RouteKind,
  locale: AppLocale,
  state: FixtureState,
): Promise<Locator> {
  if (kind === "list") {
    await expect(
      page
        .locator("h1:not(.sr-only)")
        .filter({ hasText: translateMessage(locale, "inventory2b4.list.title") }),
    ).toBeVisible();
    return page.locator("main");
  }
  if (kind === "new") {
    const root = page.locator('[data-inventory-product-page-frame="intake"]');
    await expect(root).toBeVisible();
    await expect(root).toContainText(translateMessage(locale, "inventory2b4.quick.dialog.title"));
    return root;
  }
  if (kind === "detail") {
    const root = page.locator('[data-ui="inventory-product-detail-workbench"]');
    await expect(root).toBeVisible();
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.detail.deviceWorkbench"),
    );
    await expect(root).toContainText("•••• 2345");
    await expect(root).not.toContainText("490154203237518");
    if (locale === "en" && page.viewportSize()?.width === 768) {
      await expect(root).not.toContainText(
        new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(987654.32),
      );
      await expect(root).not.toContainText(translateMessage(locale, "inventory2b4.detail.cost"));
    }
    return root;
  }
  if (kind === "edit") {
    const root = page.locator('[data-inventory-product-page-frame="edit"]');
    await expect(root).toBeVisible();
    await expect(root).toContainText(translateMessage(locale, "inventory2b4.quick.edit.save"));
    return root;
  }

  const root = page.locator('[data-ui="inventory-lifecycle-page"]');
  await expect(root).toBeVisible();
  if (kind === "reserve") {
    await expect(root).toContainText(translateMessage(locale, "inventory2b4.reservation.title"));
  } else if (kind === "sell") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.reservation.saleTitle"),
    );
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.reservation.saleDescription"),
    );
  } else if (kind === "reservation" || kind === "sale") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.sale.reservationTitle"),
    );
  } else if (kind === "after-sales-case") {
    await expect(root).toContainText(translateMessage(locale, "inventory2b4.afterSales.caseTitle"));
  } else if (state === "loading") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.afterSales.queueLoading"),
    );
  } else if (state === "error") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.afterSales.queueUnavailable"),
    );
    await expect(root).not.toContainText("RAW-INVENTORY-SECRET-SENTINEL");
  } else if (state === "empty") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.afterSales.emptyTitle"),
    );
  } else {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.afterSales.queueTitle"),
    );
  }
  if (state === "permission") {
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.availabilityCard.noPermission.title"),
    );
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.availabilityCard.noPermission.body"),
    );
    await expect(root).not.toContainText(synthetic.issue);
    await expect(root).not.toContainText(synthetic.sku);
  }
  return root;
}

async function expectCompleteLifecycleDesktopTitle(
  page: Page,
  kind: RouteKind,
  locale: AppLocale,
  width: number,
) {
  if (width < 1024) return;
  const expectedTitle =
    kind === "reserve"
      ? translateMessage(locale, "inventory2b4.reservation.title")
      : kind === "sell"
        ? translateMessage(locale, "inventory2b4.reservation.saleTitle")
        : kind === "reservation" || kind === "sale"
          ? translateMessage(locale, "inventory2b4.sale.reservationTitle")
          : kind === "after-sales"
            ? translateMessage(locale, "inventory2b4.afterSales.queueTitle")
            : kind === "after-sales-case"
              ? translateMessage(locale, "inventory2b4.afterSales.caseTitle")
              : undefined;
  if (!expectedTitle) return;

  const header = page.locator('[data-ui="inventory-lifecycle-header-nav"]');
  const heading = header.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(expectedTitle);
  const geometry = await header.evaluate((element) => {
    const title = element.querySelector<HTMLElement>(
      '[data-ui="inventory-lifecycle-header-title"]',
    );
    const headingElement = title?.querySelector<HTMLElement>("h1");
    const action = element.lastElementChild as HTMLElement | null;
    if (!title || !headingElement || !action) return null;
    const headerStyle = getComputedStyle(element);
    const headingStyle = getComputedStyle(headingElement);
    const titleRect = title.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(headingElement);
    const textRect = range.getBoundingClientRect();
    return {
      gridColumns: headerStyle.gridTemplateColumns.trim().split(/\s+/).length,
      overflowX: headingStyle.overflowX,
      textOverflow: headingStyle.textOverflow,
      whiteSpace: headingStyle.whiteSpace,
      titleRight: titleRect.right,
      actionLeft: actionRect.left,
      textLeft: textRect.left,
      textRight: textRect.right,
      titleLeft: titleRect.left,
      headingClientWidth: headingElement.clientWidth,
      headingScrollWidth: headingElement.scrollWidth,
    };
  });
  expect(geometry).not.toBeNull();
  if (kind === "after-sales") {
    expect(geometry!.gridColumns).toBe(3);
  } else {
    expect(geometry).toMatchObject({
      gridColumns: 2,
      overflowX: "visible",
      textOverflow: "clip",
      whiteSpace: "normal",
    });
  }
  expect(geometry!.headingScrollWidth).toBeLessThanOrEqual(geometry!.headingClientWidth + 1);
  expect(geometry!.titleRight).toBeLessThanOrEqual(geometry!.actionLeft + 1);
  expect(geometry!.textLeft).toBeGreaterThanOrEqual(geometry!.titleLeft - 1);
  expect(geometry!.textRight).toBeLessThanOrEqual(geometry!.titleRight + 1);
}

async function expectQuickEntryActionDock(
  root: Locator,
  kind: RouteKind,
  locale: AppLocale,
  width: number,
) {
  if (kind !== "new" || locale !== "it-IT" || width > 768) return;
  const labels = [
    translateMessage(locale, "inventory2b4.quick.frame.saveAndContinue"),
    translateMessage(locale, "inventory2b4.quick.screen.saveAndView"),
  ];
  const buttons = labels.map((label) => root.getByRole("button", { name: label, exact: true }));
  for (const [index, button] of buttons.entries()) {
    await expect(button).toBeVisible();
    await expect(button).toHaveText(labels[index]);
  }
  const geometry = await Promise.all(
    buttons.map((button) =>
      button.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      }),
    ),
  );
  for (const button of geometry) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1);
  }
  expect(geometry[0].right).toBeLessThanOrEqual(geometry[1].left + 1);
  expect(geometry[0].bottom).toBeGreaterThan(geometry[1].top);
}

async function expectDynamicFidelity(root: Locator, kind: RouteKind) {
  const expected =
    kind === "list"
      ? [synthetic.brand, synthetic.model, synthetic.sku]
      : kind === "new"
        ? []
        : kind === "detail" || kind === "edit" || kind === "reserve" || kind === "sell"
          ? [synthetic.brand, synthetic.model]
          : kind === "reservation" || kind === "sale"
            ? [synthetic.sku]
            : kind === "after-sales"
              ? [synthetic.sku, synthetic.issue]
              : [synthetic.sku, synthetic.issue, synthetic.diagnosis, synthetic.unknownStatus];
  for (const value of expected) await expect(root).toContainText(value);
}

async function exerciseRouteInteraction(
  page: Page,
  root: Locator,
  kind: RouteKind,
  locale: AppLocale,
  width: number,
  pendingCustomerSearch: Route[],
) {
  if ((kind === "new" || kind === "edit") && (width === 390 || width === 1024)) {
    const trigger = root.locator("#product-spec-network_variant-preset");
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const controls = await trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const listbox = page.locator(`#${controls}`);
    await expect(listbox).toBeVisible();
    const options = listbox.getByRole("option");
    expect(await options.count()).toBeGreaterThan(0);
    await options.last().scrollIntoViewIfNeeded();
    await expect(options.last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  }

  if (kind === "reserve" && width === 430) {
    const input = root.getByRole("combobox", {
      name: new RegExp(escapeRegExp(translateMessage(locale, "inventory2b4.reservation.customer"))),
    });
    await input.fill("Dynamic");
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.reservation.customerLoading"),
    );
    await expect.poll(() => pendingCustomerSearch.length).toBe(1);
    await pendingCustomerSearch[0]!.fulfill({ json: { data: [customerFixture()] } });
    const option = page.getByRole("option", { name: new RegExp(escapeRegExp(synthetic.customer)) });
    await expect(option).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toBeFocused();
  }

  if (kind === "new" && locale === "en" && width === 1440) {
    await root.locator("#product-brand").fill("Apple");
    await root.locator("#product-model").fill("Future Apple Model Ω");
    await expect(root).toContainText(
      translateMessage(locale, "inventory2b4.quick.colorPolicy.pending"),
    );
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNoUnexpectedFixedHan(root: Locator, locale: AppLocale) {
  if (locale === "zh-CN") return;
  const offenders = await root.evaluate(
    (node, dynamicValues) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const results: string[] = [];
      let current: Node | null;
      while ((current = walker.nextNode())) {
        const parent = current.parentElement;
        if (!parent || parent.closest('[aria-hidden="true"]')) continue;
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const text = (current.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const stripped = dynamicValues.reduce(
          (remaining, value) => remaining.split(value).join(""),
          text,
        );
        if (/[\u3400-\u9fff]/u.test(stripped)) results.push(stripped);
      }
      return [...new Set(results)];
    },
    Object.values(synthetic).filter((value) => /[\u3400-\u9fff]/u.test(value)),
  );
  expect(offenders).toEqual([]);
}

async function installStrictGate(page: Page, allowedWrites: string[]): Promise<Evidence> {
  const evidence: Evidence = {
    page,
    pageErrors: [],
    consoleMessages: [],
    forbiddenRequests: [],
    allowedReads: [],
    localWrites: [],
    externalWrites: [],
  };
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (message) => {
    evidence.consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (isAllowedRead(request)) {
      evidence.allowedReads.push(`${request.method()} ${request.url()}`);
      await route.fallback();
      return;
    }
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    if (url.origin === baseOrigin && isLoopback(url.hostname) && allowedWrites.includes(key)) {
      evidence.localWrites.push(key);
      await route.fallback();
      return;
    }
    if (isWriteMethod(request.method())) {
      if (url.origin === baseOrigin && isLoopback(url.hostname)) {
        evidence.localWrites.push(`${request.method()} ${request.url()}`);
      } else {
        evidence.externalWrites.push(`${request.method()} ${request.url()}`);
        await route.abort("aborted");
        return;
      }
    } else {
      evidence.forbiddenRequests.push(`${request.method()} ${request.url()}`);
    }
    await route.abort("blockedbyclient");
  });
  return evidence;
}

function isAllowedRead(request: Request) {
  const url = new URL(request.url());
  const method = request.method();
  if (method === "GET" || method === "HEAD") {
    if (url.protocol === "blob:") {
      return url.origin === baseOrigin && isLoopback(new URL(url.origin).hostname);
    }
    if (url.origin !== baseOrigin || !isLoopback(url.hostname)) return false;
    if (pagePaths.has(url.pathname)) return true;
    if (url.pathname.startsWith("/_next/")) return true;
    if (url.pathname === "/favicon.ico") return true;
    if (url.pathname === "/manifest.webmanifest") return true;
    if (url.pathname === "/__nextjs_font/geist-latin.woff2") return true;
    if (readGets.has(url.pathname)) return true;
  }
  if (url.origin !== baseOrigin || !isLoopback(url.hostname)) return false;
  if (method === "POST" && readPosts.has(url.pathname)) {
    return hasExpectedReadBody(url.pathname, safePostData(request));
  }
  if (method === "OPTIONS" && (readGets.has(url.pathname) || readPosts.has(url.pathname))) {
    return true;
  }
  return false;
}

function safePostData(request: Request): unknown {
  try {
    return request.postDataJSON();
  } catch {
    return undefined;
  }
}

function hasExpectedReadBody(pathname: string, body: unknown) {
  if (!isPlainRecord(body)) return false;
  if (pathname === "/api/repairdesk/inventory/products/list") {
    return hasExactBody(body, {});
  }
  if (pathname === "/api/repairdesk/inventory/summary") {
    return hasExactBody(body, {});
  }
  if (pathname === "/api/repairdesk/inventory/products/get") {
    return hasExactBody(body, { id: synthetic.productId });
  }
  if (pathname === "/api/repairdesk/inventory/products/edit-data") {
    return hasExactBody(body, { id: synthetic.productId });
  }
  if (pathname === "/api/repairdesk/inventory/catalog/search") {
    return [
      { category: "phone", limit: 100 },
      { category: "phone", brand: "Apple", limit: 100 },
      { category: "phone", brand: synthetic.brand, limit: 100 },
    ].some((expected) => hasExactBody(body, expected));
  }
  if (pathname === "/api/repairdesk/inventory/lifecycle/summary") {
    return hasExactBody(body, { id: synthetic.productId });
  }
  if (pathname === "/api/repairdesk/inventory/lifecycle/sale") {
    return ["reservation_release_2b4", "sale_release_2b4"].some((id) => hasExactBody(body, { id }));
  }
  if (pathname === "/api/repairdesk/inventory/lifecycle/after-sales") {
    return hasExactBody(body, {});
  }
  if (pathname === "/api/repairdesk/inventory/lifecycle/after-sales/case") {
    return hasExactBody(body, { id: "case_release_2b4" });
  }
  if (pathname === "/api/repairdesk/customers/search") {
    return hasExactBody(body, { q: "Dynamic", limit: 6 });
  }
  if (pathname === "/api/repairdesk/customers/list-page") {
    return hasExactBody(body, { work: "all", page: 1, pageSize: 30 });
  }
  if (pathname === "/api/repairdesk/orders/queue-summary") {
    return hasExactBody(body, { page: 1, pageSize: 20 });
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactBody(value: Record<string, unknown>, expected: Record<string, unknown>) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

async function assertEvidence(
  evidence: Evidence,
  externalProbes: string[],
  expectedLocalWrites: string[] = [],
) {
  await expect.poll(() => evidence.pageErrors).toEqual([]);
  const sensitiveConsole = evidence.consoleMessages.filter((message) =>
    [
      "RAW-INVENTORY-SECRET-SENTINEL",
      "RAW-CONFLICT-SECRET-SENTINEL",
      "RAW-OUTCOME-SECRET-SENTINEL",
      "RAW-SALE-READ-SECRET-SENTINEL",
      "+393330001122",
      "490154203237518",
      "987654.32",
      "000000000000000",
    ].some((sentinel) => message.includes(sentinel)),
  );
  expect(sensitiveConsole).toEqual([]);
  expect(evidence.forbiddenRequests).toEqual([]);
  expect(evidence.localWrites).toEqual(expectedLocalWrites);
  expect(evidence.consoleMessages.filter((message) => message.startsWith("error:"))).toEqual([]);
  expect(evidence.externalWrites).toEqual(externalProbes);
  const unhandled = await evidence.page.evaluate(
    () => (window as Window & { __release2b4Unhandled?: string[] }).__release2b4Unhandled ?? [],
  );
  expect(unhandled).toEqual([]);
}

async function probeBlockedExternalWrite(page: Page, url: string) {
  await page.evaluate(async (target) => {
    await fetch(target, {
      method: "POST",
      mode: "no-cors",
      body: "{}",
    }).catch(() => undefined);
  }, url);
}

async function switchLocale(page: Page, locale: AppLocale) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]:visible').first();
  await trigger.evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  const option = page.getByRole("menuitemradio", { name: localeDisplayNames[locale] });
  await option.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as Window & { __release2b4Document?: string }).__release2b4Document,
    ),
  ).toBe("same-document");
}

function expectLifecycleCommand(
  body: Record<string, unknown>,
  command: string,
  payload: Record<string, unknown>,
) {
  expect(body.idempotency_key).toMatch(UUID_V4);
  expect({ ...body, idempotency_key: "<uuid>" }).toEqual({
    command,
    idempotency_key: "<uuid>",
    payload,
  });
}

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const engine = testInfo.project.name.includes("webkit") ? "webkit" : "chromium";
  await page.screenshot({
    path: resolve(process.cwd(), "screenshots", "release2b4", engine, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

function apiUrl(path: string) {
  return `${baseOrigin}/api/repairdesk/${path}`;
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isWriteMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function viewportHeight(width: number) {
  return width <= 430 ? 844 : width <= 768 ? 1024 : 900;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
