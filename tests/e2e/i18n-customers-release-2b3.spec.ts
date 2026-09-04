import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
  type TestInfo,
} from "@playwright/test";
import { resolve } from "node:path";

import type {
  CustomerDetail,
  CustomerListPageResult,
  CustomerListItem,
} from "@/lib/repairdesk/api";
import type { AppLocale } from "@/shared/i18n/locales";
import { localeDisplayNames } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (!enabled) {
  throw new Error("Release 2B-3 i18n checks require REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseURL).origin;
const locales = ["zh-CN", "it-IT", "en"] as const;
const widths = [390, 430, 768, 1024, 1280, 1440] as const;
const coreCases = locales.flatMap((locale) => widths.map((width) => ({ locale, width })));
const detailCases = [
  { locale: "zh-CN", width: 390 },
  { locale: "it-IT", width: 768 },
  { locale: "en", width: 1440 },
] as const;

const synthetic = {
  customerId: "cus_1",
  customer: "动态中文客户Ω",
  phone: "+393330001122",
  email: "synthetic.customer@example.invalid",
  note: "动态中文客户备注Ω",
  contactNote: "动态中文联系备注Ω",
  tagId: "tag_release_2b3",
  tag: "动态中文标签Ω",
  deviceId: "dev_release_2b3",
  brand: "动态中文品牌Ω",
  model: "动态中文型号Ω",
  imei: "490154203237518",
  deviceNote: "动态中文设备备注Ω",
  orderIssue: "动态中文故障Ω",
  historyBody: "动态中文历史正文Ω",
  operator: "动态中文员工Ω",
  followupTitle: "维修后联系客户",
  followupNote: "动态中文回访备注Ω",
  warranty: "动态中文保修Ω",
  query: "动态中文查询Ω",
} as const;

const listUrl = `/customers?q=${encodeURIComponent(synthetic.query)}&group=active&marketing=allowed&tags=${synthetic.tagId}&page=2`;

const knownReadPosts = new Set([
  "/api/repairdesk/customers/list-page",
  "/api/repairdesk/customers/intake-search",
  "/api/repairdesk/customer/get",
  "/api/repairdesk/customers/search",
  "/api/repairdesk/inventory/summary",
  "/api/repairdesk/orders/list-page",
  "/api/repairdesk/orders/queue-summary",
]);
const knownReadGets = new Set([
  "/api/repairdesk/shell/bootstrap",
  "/api/repairdesk/settings/store",
  "/api/repairdesk/order-workflow",
  "/api/repairdesk/options",
  "/api/repairdesk/kiosk/available-devices",
]);

type Evidence = {
  pageErrors: string[];
  consoleErrors: string[];
  forbiddenRequests: string[];
  allowedLocalWrites: string[];
  blockedExternalWrites: string[];
};

test.describe.configure({ retries: 0 });

for (const { locale, width } of coreCases) {
  test(`core ${locale} ${width}px preserves customer list contracts`, async ({
    page,
  }, testInfo) => {
    const listBodies: Array<Record<string, unknown>> = [];
    const evidence = await preparePage(page, locale, { listBodies });
    await page.setViewportSize({ width, height: viewportHeight(width) });
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const root = page.locator("main");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(
      root.getByText(translateMessage(locale, "customers.title"), { exact: true }),
    ).toBeVisible();
    await expect(root.getByText(synthetic.customer, { exact: true })).toBeVisible();
    await expect(root).toContainText(synthetic.phone);
    await expect(root).toContainText(synthetic.tag);
    await expect(root).toContainText(`${synthetic.brand} ${synthetic.model}`);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(listUrl)}$`));
    await expect.poll(() => listBodies.length).toBeGreaterThan(0);
    expect(listBodies.at(-1)).toEqual({
      search: synthetic.query,
      tagIds: [synthetic.tagId],
      work: "active",
      marketing: "allowed",
      followup: "all",
      page: 2,
      pageSize: 30,
    });

    if (width < 1024) {
      await expect(root.locator('[data-customer-mobile-list="true"]')).toBeVisible();
      await expect(root.locator('[data-customer-desktop-list="true"]')).toHaveCount(0);
    } else {
      await expect(root.locator('[data-customer-desktop-list="true"]')).toBeVisible();
      await expect(root.locator('[data-customer-mobile-list="true"]')).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoVisibleOverlap(root);
    await expectNoUnexpectedFixedHan(root, locale);
    await saveScreenshot(page, testInfo, `core-${locale}-${width}`);
    await assertEvidence(page, evidence, []);
  });
}

for (const { locale, width } of detailCases) {
  test(`detail ${locale} ${width}px keeps localized responsive customer identity`, async ({
    page,
  }, testInfo) => {
    const evidence = await preparePage(page, locale);
    await page.setViewportSize({ width, height: viewportHeight(width) });
    await page.goto(`/customers/${synthetic.customerId}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const root = page.locator('[data-ui="customer-detail-page"]');
    const mobileHeader = page.locator('[data-ui="customer-detail-mobile-header"]');
    const desktopHero = page.locator('[data-ui="customer-detail-desktop-hero"]');
    const mobileActions = page.locator('[data-ui="customer-detail-mobile-actions"]');
    const appBar = page.locator('[data-app-bar="true"]');
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(root).toBeVisible();
    await expect(root).toContainText(synthetic.customer);
    await expect(root).toContainText(synthetic.phone);
    await expect(root).toContainText(synthetic.note);
    await expect(root).toContainText(synthetic.tag);
    await expect(root).toContainText(synthetic.historyBody);

    if (width === 390) {
      await expect(mobileHeader).toBeVisible();
      await expect(appBar).toBeHidden();
      await expect(desktopHero).toBeHidden();
      await expect(mobileActions).toBeVisible();
      await expectVisibleTabs(root, 5);
      await expect(root.getByRole("tablist")).toHaveCount(1);
      await root.getByRole("tab").nth(2).click();
      await expect(root).toContainText(synthetic.warranty);
    } else if (width === 768) {
      await expect(mobileHeader).toBeHidden();
      await expect(appBar).toBeVisible();
      await expect(desktopHero).toBeHidden();
      await expect(mobileActions).toBeVisible();
      await expect(page.locator('[data-app-bar="true"]:visible')).toHaveCount(1);
      await expectVisibleTabs(root, 5);
      await expect(root.getByRole("tablist")).toHaveCount(1);
      const devicesTab = root.getByRole("tab", {
        name: new RegExp(translateMessage(locale, "customers.tab.devices")),
      });
      await devicesTab.click();
      await expect(devicesTab).toHaveAttribute("aria-selected", "true");
      await expect(root).toContainText(synthetic.warranty);
    } else {
      await expect(mobileHeader).toBeHidden();
      await expect(appBar).toBeVisible();
      await expect(desktopHero).toBeVisible();
      await expect(mobileActions).toBeHidden();
      await expectVisibleTabs(root, 5);
      await expect(root.getByRole("tablist")).toHaveCount(1);
      await root.getByRole("tab").nth(2).click();
      await expect(root).toContainText(synthetic.warranty);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoUnexpectedFixedHan(root, locale);
    await saveScreenshot(page, testInfo, `detail-${locale}-${width}`);
    await assertEvidence(page, evidence, []);
  });
}

test("heavy zh-CN 390px contains identity no-match and failed create", async ({
  page,
}, testInfo) => {
  const createBodies: Array<Record<string, unknown>> = [];
  await page.route(apiUrl("customer/create"), async (route) => {
    createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      headers: { "x-repairdesk-test-status": "500" },
      json: { error: "RAW-CREATE-SECRET-SENTINEL" },
    });
  });
  await page.route(apiUrl("customers/intake-search"), async (route) => {
    await route.fulfill({ json: { data: [] } });
  });
  const evidence = await preparePage(page, "zh-CN", {
    allowedWrites: ["POST /api/repairdesk/customer/create"],
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("button", { name: translateMessage("zh-CN", "customers.list.new"), exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: translateMessage("zh-CN", "customers.list.new"),
  });
  await dialog.getByLabel(translateMessage("zh-CN", "customers.form.phone")).fill(synthetic.phone);
  await dialog
    .getByLabel(translateMessage("zh-CN", "customers.form.name"))
    .fill(synthetic.customer);
  await expect(
    dialog.getByText(translateMessage("zh-CN", "customers.create.noDuplicate"), { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", {
      name: translateMessage("zh-CN", "customers.create.saveView"),
      exact: true,
    })
    .click();
  await expect.poll(() => createBodies.length).toBe(1);
  expect(createBodies[0]).toEqual({
    input: {
      name: synthetic.customer,
      phone_e164: synthetic.phone,
      email: "",
      contact_phones: [],
      consent_marketing: true,
      consent_sms: true,
      preferred_channel: "whatsapp",
      language: "it",
      notes: "",
      marketing_notes: "",
      blacklisted: false,
    },
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(translateMessage("zh-CN", "customers.form.name"))).toHaveValue(
    synthetic.customer,
  );
  await expect(dialog.getByRole("alert")).toContainText(
    translateMessage("zh-CN", "customers.create.saveError"),
  );
  await expect(page.getByText("RAW-CREATE-SECRET-SENTINEL")).toHaveCount(0);
  const blockedExternal = externalApiUrl("customer/create");
  await probeBlockedExternalWrite(page, blockedExternal);
  await saveScreenshot(page, testInfo, "heavy-zh-CN-390-create-failure");
  await assertEvidence(
    page,
    evidence,
    [`POST ${apiUrl("customer/create")}`],
    [`POST ${blockedExternal}`],
  );
});

test("heavy it-IT 768px preserves tab identity and dialog focus contracts", async ({
  page,
}, testInfo) => {
  const evidence = await preparePage(page, "it-IT");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/customers/${synthetic.customerId}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const root = page.locator('[data-ui="customer-detail-page"]');
  const initialUrl = page.url();

  await switchLocale(page, "en");
  await expect(page).toHaveURL(initialUrl);
  await expect(root).toContainText(synthetic.customer);
  await switchLocale(page, "it-IT");
  await expect(page).toHaveURL(initialUrl);
  await expect(page.locator('[data-ui="customer-detail-mobile-header"]')).toBeHidden();
  await expect(page.locator('[data-app-bar="true"]:visible')).toHaveCount(1);
  await expectVisibleTabs(root, 5);
  await expect(root.getByRole("tablist")).toHaveCount(1);
  const devicesTab = root.getByRole("tab", {
    name: new RegExp(translateMessage("it-IT", "customers.tab.devices")),
  });
  await devicesTab.click();
  await expect(devicesTab).toHaveAttribute("aria-selected", "true");
  const deviceCard = root.getByRole("button", {
    name: translateMessage("it-IT", "customers.detail.viewDevice", {
      brand: synthetic.brand,
      model: synthetic.model,
    }),
  });
  await deviceCard.click();
  const deviceSheet = page.getByRole("dialog", {
    name: `${synthetic.brand} ${synthetic.model}`,
  });
  await expect(deviceSheet).toBeVisible();
  await expect(
    deviceSheet.getByText(translateMessage("it-IT", "orders.workflowClosed")),
  ).toBeVisible();
  await expectNoUnexpectedFixedHan(deviceSheet, "it-IT");
  await deviceSheet
    .getByRole("button", { name: translateMessage("it-IT", "customers.detail.close") })
    .click();
  await expect(deviceSheet).toBeHidden();
  const followupButton = root.getByRole("button", {
    name: translateMessage("it-IT", "customers.detail.followupShort"),
    exact: true,
  });
  await followupButton.click();
  const dialog = page.getByRole("dialog", {
    name: translateMessage("it-IT", "customers.form.followupTitle"),
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(translateMessage("it-IT", "customers.form.title"))).toHaveValue(
    synthetic.followupTitle,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(followupButton).toBeFocused();
  await expectNoUnexpectedFixedHan(root, "it-IT");
  await expectNoHorizontalOverflow(page);
  await saveScreenshot(page, testInfo, "heavy-it-IT-768-locale-followup-focus");
  await assertEvidence(page, evidence, []);
});

test("heavy en 1440px preserves preview URL, keyboard tabs, device child action, and focus", async ({
  page,
}, testInfo) => {
  const evidence = await preparePage(page, "en");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/customers", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const initialUrl = page.url();
  const previewTrigger = page.getByRole("button", {
    name: translateMessage("en", "customers.list.viewCustomer", { name: synthetic.customer }),
  });
  await previewTrigger.click();
  const preview = page.getByRole("dialog", {
    name: translateMessage("en", "customers.list.previewTitle"),
  });
  const root = preview.locator('[data-ui="customer-detail-workspace"]');
  await expect(preview).toBeVisible();
  await expect(page).toHaveURL(initialUrl);
  await expect(root).toContainText(synthetic.customer);

  const overview = root.getByRole("tab", {
    name: translateMessage("en", "customers.tab.overview"),
  });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  const orders = root.getByRole("tab", { name: /.+/ }).nth(1);
  await expect(orders).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  const devices = root.getByRole("tab", { name: /.+/ }).nth(2);
  await expect(devices).toHaveAttribute("aria-selected", "true");
  const deviceCard = root.getByRole("button", {
    name: translateMessage("en", "customers.detail.viewDevice", {
      brand: synthetic.brand,
      model: synthetic.model,
    }),
  });
  await deviceCard.click();
  const deviceSheet = page.getByRole("dialog", {
    name: `${synthetic.brand} ${synthetic.model}`,
  });
  await expect(deviceSheet).toBeVisible();
  await expect(
    deviceSheet.getByText(translateMessage("en", "orders.workflowClosed")),
  ).toBeVisible();
  await expectNoUnexpectedFixedHan(deviceSheet, "en");
  await deviceSheet
    .getByRole("button", { name: translateMessage("en", "customers.detail.close") })
    .click();
  await expect(deviceSheet).toBeHidden();
  const deviceEdit = root.getByRole("button", {
    name: translateMessage("en", "customers.detail.editShort"),
    exact: true,
  });
  await deviceEdit.click();
  await expect(
    page.getByRole("dialog", { name: translateMessage("en", "customers.form.editDeviceTitle") }),
  ).toBeVisible();
  await expect(page.getByText(translateMessage("en", "customers.detail.sheetTitle"))).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: translateMessage("en", "customers.form.editDeviceTitle") }),
  ).toBeHidden();
  await expect(deviceEdit).toBeFocused();

  await root
    .getByRole("button", { name: translateMessage("en", "customers.detail.close"), exact: true })
    .click();
  await expect(preview).toBeHidden();
  await expect(page).toHaveURL(initialUrl);
  await expect
    .poll(() => previewTrigger.evaluate((element) => document.activeElement === element))
    .toBe(true);
  await expectNoHorizontalOverflow(page);
  await saveScreenshot(page, testInfo, "heavy-en-1440-preview-keyboard-device-focus");
  await assertEvidence(page, evidence, []);
});

async function preparePage(
  page: Page,
  locale: AppLocale,
  options: {
    allowedWrites?: string[];
    listBodies?: Array<Record<string, unknown>>;
  } = {},
) {
  await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
  await installSyntheticHttpStatusBridge(page);
  await page.addInitScript(() => {
    Object.assign(window, { __release2b3Unhandled: [], __release2b3Document: "same-document" });
    window.addEventListener("unhandledrejection", (event) => {
      const state = window as Window & { __release2b3Unhandled?: string[] };
      state.__release2b3Unhandled?.push(String(event.reason));
    });
  });
  await installSyntheticCustomers(page, options.listBodies);
  return installStrictGate(page, options.allowedWrites ?? []);
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

async function installSyntheticCustomers(
  page: Page,
  listBodies: Array<Record<string, unknown>> = [],
) {
  await page.route(apiUrl("customers/list-page"), async (route) => {
    listBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    const item: CustomerListItem = {
      ...fallbackListItem(),
      id: synthetic.customerId,
      name: synthetic.customer,
      phone_e164: synthetic.phone,
      phone_raw: "3330001122",
      email: synthetic.email,
      notes: synthetic.note,
      marketing_notes: synthetic.contactNote,
      consent_marketing: true,
      consent_sms: true,
      preferred_channel: "whatsapp",
      language: "it",
      contact_phones: [],
      tags: [{ id: synthetic.tagId, name: synthetic.tag, color: "#6d5dfc" }],
      latest_device_label: `${synthetic.brand} ${synthetic.model}`,
      device_search_text: `${synthetic.brand} ${synthetic.model} ${synthetic.imei}`,
      device_count: 1,
      order_count: 1,
      valid_order_count: 1,
      active_order_count: 1,
      finance_redacted: true,
      last_order_at: "2026-09-02T08:00:00.000Z",
    };
    const data: CustomerListPageResult = {
      items: [item],
      total: 101,
      page: 2,
      pageSize: 50,
      pageCount: 3,
      tags: item.tags,
      stats: {
        total: 101,
        repeat: 0,
        activeRepairs: 1,
        unpaid: 0,
        financeRedacted: true,
        withDevices: 1,
        dueFollowups: 1,
        marketable: 1,
      },
    };
    await route.fulfill({ json: { data } });
  });
  await page.route(apiUrl("customer/get"), async (route) => {
    const data: CustomerDetail = {
      customer: {
        id: synthetic.customerId,
        name: synthetic.customer,
        phone_e164: synthetic.phone,
        phone_raw: "3330001122",
        contact_phones: [],
        email: synthetic.email,
        notes: synthetic.note,
        marketing_notes: synthetic.contactNote,
        consent_marketing: true,
        consent_sms: true,
        preferred_channel: "whatsapp",
        language: "it",
      },
      devices: [
        {
          id: synthetic.deviceId,
          customer_id: synthetic.customerId,
          brand: synthetic.brand,
          model: synthetic.model,
          serial_or_imei: synthetic.imei,
          device_notes: synthetic.deviceNote,
        },
      ],
      orders: [syntheticOrder()],
      tags: [{ id: synthetic.tagId, name: synthetic.tag, color: "#6d5dfc" }],
      interactions: [
        {
          id: "interaction_release_2b3",
          customer_id: synthetic.customerId,
          channel: "whatsapp",
          direction: "outbound",
          message_body: synthetic.historyBody,
          status: "sent",
          operator_name: synthetic.operator,
          created_at: "2026-09-02T07:00:00.000Z",
        },
      ],
      followups: [
        {
          id: "followup_release_2b3",
          customer_id: synthetic.customerId,
          title: synthetic.followupTitle,
          note: synthetic.followupNote,
          due_at: "2026-09-03T08:00:00.000Z",
          owner_name: synthetic.operator,
          status: "done",
          completed_at: "2026-09-02T08:00:00.000Z",
          created_at: "2026-09-01T08:00:00.000Z",
          updated_at: "2026-09-02T08:00:00.000Z",
        },
      ],
      stats: {
        order_count: 1,
        valid_order_count: 1,
        active_order_count: 1,
        device_count: 1,
        finance_redacted: true,
        lifetime_quoted_amount: undefined,
        outstanding_amount: undefined,
        total_spent: undefined,
        unpaid_amount: undefined,
      },
    };
    await route.fulfill({ json: { data } });
  });
}

function syntheticOrder(): CustomerDetail["orders"][number] {
  return {
    id: "ord_release_2b3",
    public_no: "R2B3-SYNTHETIC",
    order_type: "dropoff_repair",
    status: "completed",
    customer_id: synthetic.customerId,
    customer_name_snapshot: synthetic.customer,
    customer_phone_snapshot: synthetic.phone,
    device_id: synthetic.deviceId,
    issue_description: synthetic.orderIssue,
    quotation_amount: 88,
    deposit_amount: 10,
    balance_amount: 78,
    currency_code: "EUR",
    is_paid: false,
    approval_status: "approved",
    technician_name: synthetic.operator,
    contact_phones: [],
    fault_prices: [],
    device_custody_status: "with_shop",
    warranty_text: synthetic.warranty,
    finance_redacted: true,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-02T08:00:00.000Z",
    customer_name: synthetic.customer,
    customer_phone: synthetic.phone,
    device_label: `${synthetic.brand} ${synthetic.model}`,
    device_imei: synthetic.imei,
    approval_overdue: false,
    pickup_overdue: false,
  };
}

function fallbackListItem(): CustomerListItem {
  return {
    id: synthetic.customerId,
    name: synthetic.customer,
    phone_e164: synthetic.phone,
    phone_raw: "3330001122",
    contact_phones: [],
    consent_marketing: true,
    consent_sms: true,
    tags: [],
    device_count: 0,
    order_count: 0,
    active_order_count: 0,
  };
}

async function installStrictGate(page: Page, allowedWrites: string[]): Promise<Evidence> {
  const evidence: Evidence = {
    pageErrors: [],
    consoleErrors: [],
    forbiddenRequests: [],
    allowedLocalWrites: [],
    blockedExternalWrites: [],
  };
  const allowedWriteSet = new Set(allowedWrites);
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (isAllowedRead(request)) {
      await route.fallback();
      return;
    }
    if (isAllowedWrite(request, allowedWriteSet)) {
      evidence.allowedLocalWrites.push(`${request.method()} ${request.url()}`);
      await route.fallback();
      return;
    }
    const url = new URL(request.url());
    if (isWriteMethod(request.method()) && url.origin !== baseOrigin) {
      evidence.blockedExternalWrites.push(`${request.method()} ${request.url()}`);
      await route.abort("aborted");
      return;
    }
    evidence.forbiddenRequests.push(`${request.method()} ${request.url()}`);
    await route.abort("blockedbyclient");
  });
  return evidence;
}

function isAllowedRead(request: Request) {
  const url = new URL(request.url());
  const method = request.method();
  if (
    (method === "GET" || method === "HEAD") &&
    url.protocol === "blob:" &&
    url.origin === baseOrigin
  )
    return true;
  if (url.origin !== baseOrigin || !isLoopback(url.hostname)) return false;
  if (method === "GET" || method === "HEAD") {
    if (url.pathname === "/customers" || url.pathname === `/customers/${synthetic.customerId}`)
      return true;
    if (url.pathname.startsWith("/_next/")) return true;
    if (url.pathname === "/favicon.ico") return true;
    if (url.pathname === "/manifest.webmanifest") return true;
    if (url.pathname === "/__nextjs_font/geist-latin.woff2") return true;
    if (knownReadGets.has(url.pathname)) return true;
  }
  if (method === "POST" && knownReadPosts.has(url.pathname)) return true;
  if (method === "OPTIONS" && (knownReadGets.has(url.pathname) || knownReadPosts.has(url.pathname)))
    return true;
  return false;
}

function isAllowedWrite(request: Request, allowed: ReadonlySet<string>) {
  const url = new URL(request.url());
  return (
    url.origin === baseOrigin &&
    isLoopback(url.hostname) &&
    isWriteMethod(request.method()) &&
    allowed.has(`${request.method()} ${url.pathname}`)
  );
}

function isWriteMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function assertEvidence(
  page: Page,
  evidence: Evidence,
  expectedWrites: string[],
  expectedBlockedExternal: string[] = [],
) {
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.forbiddenRequests).toEqual([]);
  expect(evidence.allowedLocalWrites).toEqual(expectedWrites);
  expect(evidence.blockedExternalWrites).toEqual(expectedBlockedExternal);
  expect(
    await page.evaluate(
      () => (window as Window & { __release2b3Unhandled?: string[] }).__release2b3Unhandled ?? [],
    ),
  ).toEqual([]);
}

async function expectVisibleTabs(root: Locator, count: number) {
  await expect(root.getByRole("tab")).toHaveCount(count);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

async function expectNoVisibleOverlap(root: Locator) {
  const targets = root.locator("button:visible, a:visible, input:visible");
  const overlaps = await targets.evaluateAll((elements) => {
    const boxes = elements.slice(0, 24).map((element) => element.getBoundingClientRect());
    return boxes.flatMap((a, index) =>
      boxes.slice(index + 1).flatMap((b, offset) => {
        const intersectionWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const intersectionHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return intersectionWidth > 3 && intersectionHeight > 3
          ? [`${index}:${index + offset + 1}`]
          : [];
      }),
    );
  });
  expect(overlaps).toEqual([]);
}

async function expectNoUnexpectedFixedHan(root: Locator, locale: AppLocale) {
  if (locale === "zh-CN") return;
  const visibleHanNodes = await root.evaluate((element) => {
    const values: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.trim() ?? "";
      const parent = node.parentElement;
      if (text && /[\u3400-\u9fff]/u.test(text) && parent) {
        const style = getComputedStyle(parent);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !parent.closest('[hidden], [aria-hidden="true"]')
        )
          values.push(text);
      }
      node = walker.nextNode();
    }
    return values;
  });
  const fragments = Object.values(synthetic).filter((value) => /[\u3400-\u9fff]/u.test(value));
  const exact = [synthetic.customer.slice(0, 1)];
  const unexpected = visibleHanNodes.filter(
    (text) => !fragments.some((value) => text.includes(value)) && !exact.includes(text),
  );
  expect(unexpected).toEqual([]);
}

async function switchLocale(page: Page, locale: AppLocale) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]:visible').first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const option = page.getByRole("menuitemradio", { name: localeDisplayNames[locale] });
  await option.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  expect(
    await page.evaluate(
      () => (window as Window & { __release2b3Document?: string }).__release2b3Document,
    ),
  ).toBe("same-document");
}

async function probeBlockedExternalWrite(page: Page, url: string) {
  await page.evaluate(async (target) => {
    await fetch(target, { method: "POST", mode: "no-cors", body: "{}" }).catch(() => undefined);
  }, url);
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const engine = testInfo.project.name;
  await page.screenshot({
    path: resolve(process.cwd(), "screenshots", "release2b3", engine, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

function viewportHeight(width: number) {
  if (width <= 430) return 844;
  if (width === 768) return 1024;
  return 900;
}

function apiUrl(path: string) {
  return `${baseOrigin}/api/repairdesk/${path}`;
}

function externalApiUrl(path: string) {
  return `https://release2b3.invalid/api/repairdesk/${path}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
