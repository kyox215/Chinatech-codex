import { expect, test, type Page, type Request, type Route, type TestInfo } from "@playwright/test";
import { resolve } from "node:path";

import type { AppLocale } from "@/shared/i18n/locales";
import { localeDisplayNames } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (!enabled) {
  throw new Error("Release 2B-2 i18n checks require REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseURL).origin;
const locales = ["zh-CN", "it-IT", "en"] as const;
const widths = [390, 430, 768, 1024, 1280, 1440] as const;
const directCases = locales.flatMap((locale) => widths.map((width) => ({ locale, width })));
const workspaceCases = [
  { locale: "zh-CN", width: 390 },
  { locale: "it-IT", width: 768 },
  { locale: "en", width: 1440 },
] as const;

const synthetic = {
  customer: "动态中文客户Ω",
  brand: "华为",
  model: "Mate 自定义Ω",
  deviceNotes: "动态中文设备备注Ω",
  issue: "动态中文故障描述Ω",
  diagnosis: "动态中文检测结论Ω",
  accessory: "动态中文配件附件Ω",
  warranty: "动态中文保修Ω",
  technician: "动态中文负责人Ω",
  quoteName: "动态中文报价项目Ω",
  quoteNote: "动态中文报价备注Ω",
  historyAction: "动态中文历史动作Ω",
  operator: "动态中文操作员Ω",
} as const;

const knownReadPosts = new Set([
  "/api/repairdesk/order/get",
  "/api/repairdesk/customers/list-page",
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
  forbiddenExternalWrites: string[];
};

test.describe.configure({ retries: 0 });

for (const { locale, width } of directCases) {
  test(`direct ${locale} ${width}px keeps one localized detail renderer`, async ({
    page,
  }, testInfo) => {
    const evidence = await preparePage(page, locale, { canUploadPhoto: true });
    await page.setViewportSize({ width, height: viewportHeight(width) });
    await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const root = page.locator('[data-order-detail-root="true"]');
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(root).toBeVisible();
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute("data-order-detail-surface", "page");
    await expect(root).toHaveAttribute(
      "data-order-detail-render-mode",
      width < 1024 ? "compact" : "desktop",
    );
    await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
    await expect(root).toContainText(translateMessage(locale, "orders2b2.title"));
    await expect(root).toContainText(translateMessage(locale, "orders2b2.overview.issue"));
    if (width >= 1024) {
      await expect(root).toContainText(
        translateMessage(locale, "orders2b2.overview.approvalNotRequired"),
      );
    }
    if (locale !== "zh-CN") await expect(root).not.toContainText("not_required");
    await expectDynamicDetail(root);
    await expectResponsiveActions(root, width);
    if (width < 1024) {
      await expectCompleteMobileDeviceTitle(root, locale);
      await expectSeparatedDetailRows(root, locale);
    }
    await expectNoHorizontalOverflow(page);
    await expectNoUnexpectedFixedHan(root, locale);
    await expectContentAboveFixedDock(page, root, width);
    await saveEvidenceScreenshot(page, testInfo, `direct-${locale}-${width}`);
    await assertEvidence(page, evidence, []);
  });
}

for (const { locale, width } of workspaceCases) {
  test(`workspace ${locale} ${width}px preserves dialog identity and selected records tab`, async ({
    page,
  }, testInfo) => {
    const evidence = await preparePage(page, locale, { canUploadPhoto: true });
    await page.setViewportSize({ width, height: viewportHeight(width) });
    const workspaceUrl = "/orders?workspace=order-detail&orderId=ord_1&source=i18n-release-2b2";
    await page.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const dialog = page.locator('[data-order-detail-dialog-shell="true"]');
    const root = dialog.locator('[data-order-detail-root="true"]');
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(dialog).toBeVisible();
    await expect(root).toHaveCount(1);
    await expect(root).toHaveAttribute("data-order-detail-surface", "dialog");
    await expect(root).toHaveAttribute("data-order-detail-render-mode", "desktop");
    await expect(page.locator("[data-order-detail-renderer]")).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(workspaceUrl)}$`));
    await expect(page.locator("#order-detail-workspace-tab-overview")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectDynamicDetail(root);

    await page.locator("#order-detail-workspace-tab-records").click();
    await expect(page.locator("#order-detail-workspace-tab-records")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.locator("#order-records-group-tab-timeline").click();
    await expect(page.locator("#order-records-group-tab-timeline")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectExactVisible(root, synthetic.historyAction);
    await expectExactVisible(root, synthetic.operator);
    await expect(root.locator('[data-order-action-dock="true"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoUnexpectedFixedHan(root, locale);
    await saveEvidenceScreenshot(page, testInfo, `workspace-${locale}-${width}`);
    await assertEvidence(page, evidence, []);
  });
}

test("heavy zh-CN 390px hides every photo entry without capability and sends zero uploads", async ({
  page,
}, testInfo) => {
  const evidence = await preparePage(page, "zh-CN", { canUploadPhoto: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const root = page.locator('[data-order-detail-root="true"]');
  await expect(root).toBeVisible();
  for (const photoKey of ["front", "back", "other"] as const) {
    await expect(
      root.getByRole("button", {
        name: `${translateMessage("zh-CN", "orders2b2.overview.capture")} ${translateMessage("zh-CN", `orders2b2.photo.${photoKey}`)}`,
        exact: true,
      }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("dialog", { name: translateMessage("zh-CN", "camera.title") }),
  ).toHaveCount(0);
  await expectDynamicDetail(root);
  await expectNoHorizontalOverflow(page);
  await saveEvidenceScreenshot(page, testInfo, "heavy-zh-CN-390-no-photo-capability");
  await assertEvidence(page, evidence, []);
});

test("heavy it-IT 768px uploads exact front, back and other photos through the real sheet", async ({
  page,
}, testInfo) => {
  const uploadBodies: Array<Record<string, unknown>> = [];
  const photoCases = [
    { key: "front", kind: "device_front", fileName: "release-2b2-front.jpg" },
    { key: "back", kind: "device_back", fileName: "release-2b2-back.jpg" },
    { key: "other", kind: "other", fileName: "release-2b2-other.jpg" },
  ] as const;
  await page.route(apiUrl("order/attachment/upload"), async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const input = body.input as Record<string, unknown>;
    uploadBodies.push(body);
    await route.fulfill({
      json: {
        data: {
          id: `attachment-${String(input.kind)}`,
          order_id: "ord_1",
          kind: input.kind,
          file_name: input.file_name,
          mime_type: "image/jpeg",
          file_size: input.file_size,
          storage_bucket: "synthetic-release-2b2",
          storage_path: `orders/ord_1/${String(input.file_name)}`,
          created_at: "2026-09-02T08:00:00.000Z",
          updated_at: "2026-09-02T08:00:00.000Z",
        },
      },
    });
  });
  const evidence = await preparePage(page, "it-IT", {
    canUploadPhoto: true,
    allowedWrites: ["POST /api/repairdesk/order/attachment/upload"],
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const root = page.locator('[data-order-detail-root="true"]');
  const camera = page.getByRole("dialog", { name: translateMessage("it-IT", "camera.title") });
  for (const [index, photo] of photoCases.entries()) {
    const bytes = Buffer.from(`release-2b2-synthetic-${photo.key}`);
    await root
      .getByRole("button", {
        name: `${translateMessage("it-IT", "orders2b2.overview.capture")} ${translateMessage("it-IT", `orders2b2.photo.${photo.key}`)}`,
        exact: true,
      })
      .click();
    await expect(camera).toBeVisible();
    await camera.locator('input[type="file"][accept="image/*"]').setInputFiles({
      name: photo.fileName,
      mimeType: "image/jpeg",
      buffer: bytes,
    });
    await expect.poll(() => uploadBodies.length).toBe(index + 1);
    await expect(camera).toHaveCount(0);
  }
  expect(uploadBodies).toEqual(
    photoCases.map((photo) => {
      const bytes = Buffer.from(`release-2b2-synthetic-${photo.key}`);
      return {
        id: "ord_1",
        input: {
          kind: photo.kind,
          file_name: photo.fileName,
          mime_type: "image/jpeg",
          file_size: bytes.length,
          data_base64: bytes.toString("base64"),
        },
      };
    }),
  );
  await expect(
    page.getByText(translateMessage("it-IT", "orders2b2.success.attachment")).last(),
  ).toBeVisible();
  const blockedExternalUpload = externalApiUrl("order/attachment/upload");
  await probeBlockedExternalWrite(page, blockedExternalUpload);
  await expectDynamicDetail(root);
  await expectNoHorizontalOverflow(page);
  await expectNoUnexpectedFixedHan(root, "it-IT");
  await saveEvidenceScreenshot(page, testInfo, "heavy-it-IT-768-fault-photo");
  await assertEvidence(
    page,
    evidence,
    photoCases.map(() => `POST ${apiUrl("order/attachment/upload")}`),
    [`POST ${blockedExternalUpload}`],
  );
});

test("heavy en 1440px preserves finance draft then one pending transition across en-it-en", async ({
  page,
}, testInfo) => {
  const transitionBodies: Array<Record<string, unknown>> = [];
  let releaseTransition: (() => void) | undefined;
  const transitionRelease = new Promise<void>((resolveRelease) => {
    releaseTransition = resolveRelease;
  });
  await page.route(apiUrl("order/transition"), async (route) => {
    transitionBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await transitionRelease;
    await route.fulfill({ json: { data: { id: "ord_1", status: "repairing" } } });
  });
  const evidence = await preparePage(page, "en", {
    canUploadPhoto: true,
    allowedWrites: ["POST /api/repairdesk/order/transition"],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/orders/ord_1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const root = page.locator('[data-order-detail-root="true"]');
  const initialUrl = page.url();
  await page.evaluate(() => {
    Object.assign(window, { __release2b2DocumentMarker: "same-order-document" });
  });

  await root
    .getByRole("button", { name: translateMessage("en", "orders2b2.hero.edit"), exact: true })
    .click();
  const quoteNameEn = root.getByLabel(
    translateMessage("en", "orders2b2.overview.itemName", { index: 1 }),
  );
  const financeDraft = "Employee finance draft Ω";
  await quoteNameEn.fill(financeDraft);
  await quoteNameEn.focus();
  const financeScroll = await setStableScroll(page, 20);
  await switchLocale(page, "it-IT");
  await expectPreservedIdentity(page, root, initialUrl, financeScroll, {
    inputLabel: translateMessage("it-IT", "orders2b2.overview.customer"),
  });
  await expect(
    root.getByLabel(translateMessage("it-IT", "orders2b2.overview.itemName", { index: 1 })),
  ).toHaveValue(financeDraft);
  await switchLocale(page, "en");
  await expectPreservedIdentity(page, root, initialUrl, financeScroll, {
    inputLabel: translateMessage("en", "orders2b2.overview.customer"),
  });
  await expect(quoteNameEn).toHaveValue(financeDraft);
  await root
    .getByRole("button", { name: translateMessage("en", "orders2b2.hero.cancel"), exact: true })
    .click();
  await expect(quoteNameEn).toHaveCount(0);

  const flowButton = root.getByRole("button", {
    name: translateMessage("en", "orders2b2.overview.flowAction"),
    exact: true,
  });
  await flowButton.click();
  const transitionPanel = root.locator('[data-order-desktop-transition-panel="true"]');
  await expect(transitionPanel).toBeVisible();
  const targetLabel = translateMessage("en", "orders.workflowRepair");
  await transitionPanel
    .getByRole("button", { name: new RegExp(`→\\s*${escapeRegExp(targetLabel)}`) })
    .filter({ hasNotText: translateMessage("en", "orders2b2.transition.reason") })
    .click();
  await expect.poll(() => transitionBodies.length).toBe(1);
  const capturedBody = structuredClone(transitionBodies[0]);
  expect(capturedBody).toMatchObject({
    id: "ord_1",
    to: "repairing",
    expected_updated_at: "2026-09-02T08:00:00.000Z",
  });
  expect(capturedBody?.reason).toBeUndefined();
  expect(capturedBody?.idempotency_key).toEqual(expect.any(String));
  expect(capturedBody?.idempotency_key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  await expect(flowButton).toBeDisabled();
  const pendingScroll = await setStableScroll(page, 20);
  await switchLocale(page, "it-IT");
  await expectPreservedIdentity(page, root, initialUrl, pendingScroll);
  await expect(
    root.getByRole("button", {
      name: translateMessage("it-IT", "orders2b2.overview.flowAction"),
      exact: true,
    }),
  ).toBeDisabled();
  expect(transitionBodies).toEqual([capturedBody]);
  await switchLocale(page, "en");
  await expectPreservedIdentity(page, root, initialUrl, pendingScroll);
  await expect(flowButton).toBeDisabled();
  expect(transitionBodies).toEqual([capturedBody]);
  await expectNoUnexpectedFixedHan(root, "en");
  await saveEvidenceScreenshot(page, testInfo, "heavy-en-1440-finance-transition-pending");

  const blockedExternalTransition = externalApiUrl("order/transition");
  await probeBlockedExternalWrite(page, blockedExternalTransition);

  releaseTransition?.();
  await expect.poll(() => transitionBodies.length).toBe(1);
  await expect(flowButton).toBeEnabled();
  await page.waitForLoadState("networkidle");
  await assertEvidence(
    page,
    evidence,
    [`POST ${apiUrl("order/transition")}`],
    [`POST ${blockedExternalTransition}`],
  );
  await page.unrouteAll({ behavior: "wait" });
});

async function preparePage(
  page: Page,
  locale: AppLocale,
  options: { canUploadPhoto: boolean; allowedWrites?: string[] },
) {
  await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
  await page.addInitScript(() => {
    Object.assign(window, { __release2b2Unhandled: [] });
    window.addEventListener("unhandledrejection", (event) => {
      const state = window as Window & { __release2b2Unhandled?: string[] };
      state.__release2b2Unhandled?.push(String(event.reason));
    });
  });
  await installSyntheticDetail(page, options.canUploadPhoto);
  return installStrictGate(page, options.allowedWrites ?? []);
}

async function installSyntheticDetail(page: Page, canUploadPhoto: boolean) {
  await page.route(apiUrl("order/get"), async (route) => {
    const response = await route.fetch();
    const payload = (await response.json()) as {
      data: {
        order: Record<string, unknown>;
        customer?: Record<string, unknown>;
        device?: Record<string, unknown>;
        events?: unknown[];
        messages?: unknown[];
        attachments?: unknown[];
        capabilities?: Record<string, unknown>;
      };
    };
    const order = payload.data.order;
    Object.assign(order, {
      status: "diagnosing",
      workflow_status: "active",
      workflow_bucket: "diagnosing",
      record_state: "active",
      deleted_at: null,
      updated_at: "2026-09-02T08:00:00.000Z",
      created_at: "2026-09-01T08:00:00.000Z",
      customer_name: synthetic.customer,
      customer_name_snapshot: synthetic.customer,
      customer_phone: "+393330001122",
      contact_phones: ["+393330001122"],
      device_label: `${synthetic.brand} ${synthetic.model}`,
      device_snapshot: {
        brand: synthetic.brand,
        model: synthetic.model,
        serial_or_imei: "490154203237518",
        device_notes: synthetic.deviceNotes,
      },
      issue_description: synthetic.issue,
      diagnosis_result: synthetic.diagnosis,
      accessory_notes: synthetic.accessory,
      warranty_text: synthetic.warranty,
      technician_name: synthetic.technician,
      device_custody_status: "with_shop",
      quotation_amount: 88,
      deposit_amount: 10,
      balance_amount: 78,
      approval_status: "not_required",
      finance_redacted: false,
      fault_prices: [
        {
          catalog_key: "synthetic-release-2b2",
          name: synthetic.quoteName,
          price: 88,
          note: synthetic.quoteNote,
        },
      ],
    });
    payload.data.customer = {
      ...(payload.data.customer ?? {}),
      id: "customer-release-2b2",
      name: synthetic.customer,
      phone_e164: "+393330001122",
      phone_raw: "3330001122",
      contact_phones: [],
    };
    payload.data.device = {
      ...(payload.data.device ?? {}),
      id: "device-release-2b2",
      brand: synthetic.brand,
      model: synthetic.model,
      serial_or_imei: "490154203237518",
      device_notes: synthetic.deviceNotes,
    };
    payload.data.events = [
      {
        id: "event-release-2b2",
        order_id: "ord_1",
        event_type: "note",
        payload: { action: synthetic.historyAction },
        operator_name: synthetic.operator,
        created_at: "2026-09-02T07:00:00.000Z",
      },
    ];
    payload.data.messages = [];
    payload.data.attachments = [];
    payload.data.capabilities = {
      ...(payload.data.capabilities ?? {}),
      canEditIntake: true,
      canEditRepair: true,
      canAdjustFinance: true,
      canTransition: true,
      canUploadPhoto,
    };
    await route.fulfill({ response, json: payload });
  });
}

async function installStrictGate(page: Page, allowedWrites: string[]): Promise<Evidence> {
  const evidence: Evidence = {
    pageErrors: [],
    consoleErrors: [],
    forbiddenRequests: [],
    allowedLocalWrites: [],
    forbiddenExternalWrites: [],
  };
  const allowedWriteSet = new Set(allowedWrites);
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const key = requestKey(request);
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
      evidence.forbiddenExternalWrites.push(`${request.method()} ${request.url()}`);
      await route.abort("aborted");
      return;
    } else {
      evidence.forbiddenRequests.push(`${key} ${request.url()}`);
    }
    await route.abort("blockedbyclient");
  });
  return evidence;
}

function isAllowedRead(request: Request) {
  const url = new URL(request.url());
  if (url.origin !== baseOrigin || !isLoopback(url.hostname)) return false;
  const method = request.method();
  if (method === "GET" || method === "HEAD") {
    if (url.pathname === "/orders" || url.pathname === "/orders/ord_1") return true;
    if (url.pathname.startsWith("/_next/")) return true;
    if (url.pathname === "/recovery-probe.txt") return true;
    if (url.pathname === "/favicon.ico") return true;
    if (url.pathname === "/manifest.webmanifest") return true;
    if (url.pathname === "/__nextjs_font/geist-latin.woff2") return true;
    if (knownReadGets.has(url.pathname)) return true;
  }
  if (method === "POST" && knownReadPosts.has(url.pathname)) return true;
  if (
    method === "OPTIONS" &&
    (knownReadGets.has(url.pathname) || knownReadPosts.has(url.pathname))
  ) {
    return true;
  }
  return false;
}

function requestKey(request: Request) {
  return `${request.method()} ${new URL(request.url()).pathname}`;
}

function isAllowedWrite(request: Request, allowedWriteSet: ReadonlySet<string>) {
  const url = new URL(request.url());
  return (
    url.origin === baseOrigin &&
    isLoopback(url.hostname) &&
    isWriteMethod(request.method()) &&
    allowedWriteSet.has(requestKey(request))
  );
}

function isWriteMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method) && method !== "POST-READ";
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function assertEvidence(
  page: Page,
  evidence: Evidence,
  expectedAllowedLocalWrites: string[],
  expectedBlockedExternalWrites: string[] = [],
) {
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.forbiddenRequests).toEqual([]);
  expect(evidence.allowedLocalWrites).toEqual(expectedAllowedLocalWrites);
  expect(evidence.forbiddenExternalWrites).toEqual(expectedBlockedExternalWrites);
  expect(
    await page.evaluate(
      () => (window as Window & { __release2b2Unhandled?: string[] }).__release2b2Unhandled ?? [],
    ),
  ).toEqual([]);
}

async function probeBlockedExternalWrite(page: Page, url: string) {
  await page.evaluate(async (probeUrl) => {
    await fetch(probeUrl, { method: "POST", mode: "no-cors", body: "{}" }).catch(() => undefined);
  }, url);
}

async function expectDynamicDetail(root: ReturnType<Page["locator"]>) {
  await expectExactVisible(root, synthetic.customer);
  await expectExactVisible(root, synthetic.issue);
  await expect(root).toContainText(synthetic.model);
  await expect(root).toContainText(synthetic.quoteName);
}

async function expectExactVisible(root: ReturnType<Page["locator"]>, text: string) {
  await expect(
    root.getByText(text, { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
}

async function expectResponsiveActions(root: ReturnType<Page["locator"]>, width: number) {
  if (width < 1024) {
    await expect(root.locator('[data-mobile-order-page="true"]')).toBeVisible();
    await expect(root.locator('[data-mobile-order-action-dock="true"]')).toBeVisible();
  } else {
    await expect(root.locator('[data-order-desktop-single-workspace="true"]')).toBeVisible();
    await expect(root.locator('[data-order-action-dock="true"]')).toBeVisible();
  }
}

async function expectCompleteMobileDeviceTitle(
  root: ReturnType<Page["locator"]>,
  locale: AppLocale,
) {
  const title = root
    .locator('[data-mobile-section-title="true"]')
    .filter({ hasText: translateMessage(locale, "orders2b2.overview.deviceIssue") })
    .locator('[data-mobile-section-title-text="true"]');
  await expect(title).toHaveText(translateMessage(locale, "orders2b2.overview.deviceIssue"));
  expect(
    await title.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clipped: element.scrollHeight > element.clientHeight + 1,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      };
    }),
  ).toEqual({ clipped: false, overflow: "visible", textOverflow: "clip", whiteSpace: "normal" });
}

async function expectSeparatedDetailRows(root: ReturnType<Page["locator"]>, locale: AppLocale) {
  const rows = root.locator('[data-order-detail-row="true"]:visible');
  await expect(rows).toHaveCount(3);
  const custody = root.locator('[data-order-device-custody="true"]:visible');
  await expect(custody).toHaveCount(1);
  await expect(custody).toHaveAttribute("data-order-custody-mode", "compact");
  await expect(custody).toContainText(translateMessage(locale, "orders.custodyShop"));
  const intersections = await rows.evaluateAll((elements) =>
    elements.map((element) => {
      const label = element.querySelector<HTMLElement>('[data-order-detail-row-label="true"]');
      const value = element.querySelector<HTMLElement>('[data-order-detail-row-value="true"]');
      if (!label || !value) return true;
      const a = label.getBoundingClientRect();
      const b = value.getBoundingClientRect();
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }),
  );
  expect(intersections).toEqual([false, false, false]);
}

async function expectContentAboveFixedDock(
  page: Page,
  root: ReturnType<Page["locator"]>,
  width: number,
) {
  const initialScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() =>
      page.evaluate(
        () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1,
      ),
    )
    .toBe(true);
  const content = root.locator('[data-order-detail-content-end="true"]:visible');
  const dock = root.locator(
    width < 1024
      ? '[data-mobile-order-action-dock="true"]:visible'
      : '[data-order-action-dock="true"]:visible',
  );
  const [contentBox, dockBox] = await Promise.all([content.boundingBox(), dock.boundingBox()]);
  expect(contentBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(dockBox!.y);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), initialScroll);
}

async function expectNoUnexpectedFixedHan(root: ReturnType<Page["locator"]>, locale: AppLocale) {
  if (locale === "zh-CN") return;
  const visibleHanNodes = await root.evaluate((element) => {
    const nodes: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.trim() ?? "";
      const parent = node.parentElement;
      if (text && /[\u3400-\u9fff]/u.test(text) && parent) {
        const style = getComputedStyle(parent);
        const hiddenAncestor = parent.closest('[hidden], [aria-hidden="true"]');
        if (style.display !== "none" && style.visibility !== "hidden" && !hiddenAncestor) {
          nodes.push(text);
        }
      }
      node = walker.nextNode();
    }
    return nodes;
  });
  const dynamicValues = Object.values(synthetic);
  const fragmentDynamicValues = [...dynamicValues, `${synthetic.brand} ${synthetic.model}`];
  const exactDynamicValues = [synthetic.customer.slice(0, 1), "6个月"];
  const scannerBoundary = [
    /^扫码$/,
    /^IMEI \/ 序列号$/,
    /^扫码录入 IMEI \/ 序列号$/,
    /^扫描或输入 IMEI \/ 序列号$/,
  ];
  const unexpected = visibleHanNodes.filter(
    (text) =>
      !fragmentDynamicValues.some((value) => text.includes(value)) &&
      !exactDynamicValues.includes(text) &&
      !scannerBoundary.some((pattern) => pattern.test(text)),
  );
  expect(unexpected).toEqual([]);
}

async function switchLocale(page: Page, locale: AppLocale) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]:visible').first();
  await expect(trigger).toBeVisible();
  await trigger.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  const option = page.getByRole("menuitemradio", { name: localeDisplayNames[locale] });
  await expect(option).toBeVisible();
  await option.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect
    .poll(() => trigger.evaluate((element) => document.activeElement === element))
    .toBe(true);
}

async function expectPreservedIdentity(
  page: Page,
  root: ReturnType<Page["locator"]>,
  url: string,
  scrollY: number,
  options?: { inputLabel?: string },
) {
  expect(page.url()).toBe(url);
  await expect(root).toHaveCount(1);
  await expect(root).toContainText("R2026");
  if (options?.inputLabel) {
    await expect(root.getByRole("textbox", { name: options.inputLabel })).toHaveValue(
      synthetic.customer,
    );
  } else {
    await expectExactVisible(root, synthetic.customer);
  }
  expect(
    await page.evaluate(
      () => (window as Window & { __release2b2DocumentMarker?: string }).__release2b2DocumentMarker,
    ),
  ).toBe("same-order-document");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
}

async function setStableScroll(page: Page, y: number) {
  return page.evaluate((nextY) => {
    window.scrollTo(0, nextY);
    return window.scrollY;
  }, y);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
}

async function saveEvidenceScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: resolve("screenshots", "release2b2", testInfo.project.name, `${name}.png`),
    animations: "disabled",
  });
}

function viewportHeight(width: number) {
  if (width <= 390) return 844;
  if (width <= 430) return 932;
  if (width <= 768) return 1024;
  return 900;
}

function apiUrl(path: string) {
  return `${baseOrigin}/api/repairdesk/${path}`;
}

function externalApiUrl(path: string) {
  return `https://release2b2.invalid/api/repairdesk/${path}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
