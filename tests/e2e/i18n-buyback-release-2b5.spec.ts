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

import type { InventoryListItem } from "@/lib/repairdesk/types";
import type { AppLocale } from "@/shared/i18n/locales";
import { localeDisplayNames } from "@/shared/i18n/locales";
import { translateMessage } from "@/shared/i18n/messages";

const enabled = process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP === "1";
if (!enabled) {
  throw new Error("Release 2B-5 i18n checks require REPAIRDESK_E2E_BUSINESS_DESKTOP=1.");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const baseOrigin = new URL(baseURL).origin;
const locales = ["zh-CN", "it-IT", "en"] as const;
const widths = [390, 430, 768, 1024, 1280, 1440] as const;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fullImei = /(?<!\d)\d{15}(?!\d)/u;
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const documentNumber = /\b(?:[A-Z]{2}\d{5}[A-Z]{2}|[A-Z]{2}\d{7})\b/iu;
const visibleUrl = /https?:\/\/\S+/iu;

const synthetic = {
  storeId: "store-release-2b5",
  storeName: "Synthetic Store Ω",
  membershipId: "membership-release-2b5",
  recordId: "record-release-2b5",
  publicNo: "BB-DEMO-251",
  itemLabel: "Demo Phone Ω",
  brand: "DemoBrand Ω",
  model: "Model Demo Ω",
  color: "Demo Blue Ω",
  identifierTail: "4518",
  revisionId: "revision-release-2b5",
  actor: "Synthetic Operator Ω",
  historyReason: "Synthetic reassessment Ω",
  draftModel: "Draft Model Ω",
  draftColor: "Draft Blue Ω",
  draftReason: "Synthetic condition adjustment Ω",
  rawSentinel: "PROVIDER-SECRET-SENTINEL",
} as const;

type FixtureState = "ready" | "loading" | "empty" | "error" | "no-store" | "permission";

type Control = {
  state: FixtureState;
  online: boolean;
  listItem: InventoryListItem;
  listBodies: Array<Record<string, unknown>>;
  historyBodies: Array<Record<string, unknown>>;
  createBodies: Array<Record<string, unknown>>;
  reviseBodies: Array<Record<string, unknown>>;
  responseBodies: Array<Record<string, unknown>>;
  pendingList: Route[];
  pendingCreate: Route[];
  reviseConflictOnce: boolean;
  responseUnknownOnce: boolean;
  confirmedResponse: boolean;
};

type Evidence = {
  pageErrors: string[];
  consoleMessages: string[];
  forbiddenRequests: string[];
  allowedReads: string[];
  allowedWrites: string[];
  blockedLocalWrites: string[];
  blockedExternalRequests: string[];
};

const pagePaths = new Set(["/buyback"]);
const readGets = new Set([
  "/api/repairdesk/shell/bootstrap",
  "/api/repairdesk/onboarding/status",
  "/api/repairdesk/stores/context",
  "/api/repairdesk/settings/store",
  "/api/repairdesk/order-workflow",
  "/api/repairdesk/options",
  "/api/repairdesk/kiosk/available-devices",
]);
const readPosts = new Set([
  "/api/repairdesk/inventory/list",
  "/api/repairdesk/buyback/quote/history",
  "/api/repairdesk/inventory/summary",
  "/api/repairdesk/orders/queue-summary",
  "/api/repairdesk/customers/list-page",
]);
const commandPosts = new Set([
  "/api/repairdesk/buyback/quote/create",
  "/api/repairdesk/buyback/quote/revise",
  "/api/repairdesk/buyback/quote/respond",
]);
const forbiddenSensitivePath =
  /(?:upload|attachment|evidence|payment|finalize|legal|agreement|signature|whatsapp)/iu;

test.describe.configure({ retries: 0 });

for (const locale of locales) {
  for (const width of widths) {
    test(`core ${locale} ${width}px list workspace detail`, async ({ page }, testInfo) => {
      const control = createControl();
      const evidence = await preparePage(page, locale, control);
      await page.setViewportSize({ width, height: viewportHeight(width) });
      await page.goto("/buyback", { waitUntil: "domcontentloaded" });
      await expectReadyList(page, locale);

      const root = page.locator("main");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(root.getByText(synthetic.itemLabel, { exact: true })).toBeVisible();
      await expect(root).toContainText(`••••${synthetic.identifierTail}`);
      await expectNoUnexpectedFixedHan(root, locale);
      await expectNoHorizontalOverflow(page);
      await expectLongCopyNotClipped(root, locale);
      if (width <= 768) {
        await expectCriticalTouchTarget(newQuoteCandidate(page, locale));
      }
      await saveScreenshot(page, testInfo, `list-${locale}-${width}`);

      const newQuote = newQuoteCandidate(page, locale);
      await newQuote.focus();
      await newQuote.click();
      const workspace = page.getByRole("dialog", {
        name: translateMessage(locale, "buyback2b5.workspace.create"),
      });
      await expect(workspace).toBeVisible();
      await expect(workspace).toContainText(
        translateMessage(locale, "buyback2b5.workspace.description"),
      );
      await workspace
        .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.model") })
        .fill(synthetic.draftModel);
      await workspace
        .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.color") })
        .fill(synthetic.draftColor);
      await workspace
        .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.battery") })
        .fill("87");
      await expectFooterReachable(workspace, "workspace");
      if (width <= 768) {
        await expectCriticalTouchTarget(
          workspace.getByRole("button", {
            name: translateMessage(locale, "buyback2b5.workspace.save"),
          }),
        );
      }
      await expectNoHorizontalOverflow(page);
      await expectNoUnexpectedFixedHan(workspace, locale);
      if (width <= 430) await expectMobileInputFont(workspace);
      await saveScreenshot(page, testInfo, `workspace-${locale}-${width}`);

      await page.keyboard.press("Escape");
      await expect(workspace).toBeHidden();
      await expect(newQuote).toBeFocused();

      const card = root.getByRole("button", { name: new RegExp(synthetic.publicNo) });
      await card.focus();
      await card.click();
      const detail = page.getByRole("dialog", { name: synthetic.itemLabel });
      await expect(detail).toBeVisible();
      await expect(detail).toContainText(synthetic.publicNo);
      await expect(detail).toContainText(`••••${synthetic.identifierTail}`);
      await expectFooterReachable(detail, "detail");
      await expectQuoteOnly(detail);
      await expectNoUnexpectedFixedHan(detail, locale);
      await expectNoHorizontalOverflow(page);
      await saveScreenshot(page, testInfo, `detail-${locale}-${width}`);

      await page.keyboard.press("Escape");
      await expect(detail).toBeHidden();
      await expect(card).toBeFocused();
      await assertEvidence(page, evidence, []);
    });
  }
}

test("high risk loading empty filtered error and stale states", async ({ page }, testInfo) => {
  const control = createControl({ state: "loading" });
  const evidence = await preparePage(page, "it-IT", control, [
    "POST /api/repairdesk/buyback/quote/create",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel(translateMessage("it-IT", "buyback2b5.loading"))).toBeVisible();
  await saveScreenshot(page, testInfo, "state-loading-it-IT-390");

  for (const route of control.pendingList.splice(0)) await route.abort("aborted");
  control.state = "empty";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: translateMessage("it-IT", "buyback2b5.empty.title") }),
  ).toBeVisible();
  await saveScreenshot(page, testInfo, "state-true-empty-it-IT-390");

  control.state = "ready";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectReadyList(page, "it-IT");
  const filter = page
    .getByRole("combobox", { name: translateMessage("it-IT", "buyback2b5.filter.label") })
    .first();
  await filter.click();
  await page
    .getByRole("option", { name: translateMessage("it-IT", "buyback2b5.filter.accepted") })
    .click();
  await expect(
    page.getByRole("heading", {
      name: translateMessage("it-IT", "buyback2b5.empty.filtered.title"),
    }),
  ).toBeVisible();
  await saveScreenshot(page, testInfo, "state-filtered-empty-it-IT-390");

  control.state = "error";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: translateMessage("it-IT", "buyback2b5.loadError.title") }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(synthetic.rawSentinel);
  await saveScreenshot(page, testInfo, "state-safe-error-it-IT-390");

  control.state = "ready";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectReadyList(page, "it-IT");
  await visibleButton(page, translateMessage("it-IT", "buyback2b5.new")).click();
  const workspace = page.getByRole("dialog", {
    name: translateMessage("it-IT", "buyback2b5.workspace.create"),
  });
  await workspace
    .getByRole("textbox", { name: translateMessage("it-IT", "buyback2b5.workspace.model") })
    .fill(synthetic.draftModel);
  await workspace
    .getByRole("button", { name: translateMessage("it-IT", "buyback2b5.workspace.save") })
    .click();
  await expect.poll(() => control.createBodies.length).toBe(1);
  control.state = "error";
  await control.pendingCreate[0]!.fulfill({ json: { data: commandResult("created") } });
  await expect(workspace).toContainText(
    translateMessage("it-IT", "buyback2b5.operation.syncFailed"),
  );
  await saveScreenshot(page, testInfo, "state-sync-failure-it-IT-390");
  await page.keyboard.press("Escape");
  await expect(workspace).toBeHidden();
  await expect(page.getByText(translateMessage("it-IT", "buyback2b5.stale"))).toBeVisible();
  await expect(page.locator("body")).not.toContainText(synthetic.rawSentinel);
  await saveScreenshot(page, testInfo, "state-stale-it-IT-390");
  await assertEvidence(page, evidence, ["POST /api/repairdesk/buyback/quote/create"]);
});

test("high risk no-store permission and offline states remain zero-write", async ({
  page,
}, testInfo) => {
  const control = createControl({ state: "no-store" });
  const evidence = await preparePage(page, "en", control);
  await page.setViewportSize({ width: 430, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: translateMessage("en", "buyback2b5.store.none.title") }),
  ).toBeVisible();
  await saveScreenshot(page, testInfo, "state-no-store-en-430");

  control.state = "permission";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectReadyList(page, "en");
  await expect(page.getByText(translateMessage("en", "buyback2b5.readOnly"))).toBeVisible();
  await expect(visibleButton(page, translateMessage("en", "buyback2b5.new"))).toBeDisabled();
  await saveScreenshot(page, testInfo, "state-no-permission-en-430");

  control.state = "ready";
  control.online = false;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByText(translateMessage("en", "buyback2b5.offline"))).toBeVisible();
  await visibleButton(page, translateMessage("en", "buyback2b5.new")).click();
  await expect(
    page
      .getByRole("dialog", { name: translateMessage("en", "buyback2b5.workspace.create") })
      .getByRole("button", { name: translateMessage("en", "buyback2b5.workspace.save") }),
  ).toBeDisabled();
  await saveScreenshot(page, testInfo, "state-offline-en-430");
  await assertEvidence(page, evidence, []);
});

test("invalid create is localized, focuses model and performs zero writes", async ({
  page,
}, testInfo) => {
  const control = createControl();
  const evidence = await preparePage(page, "en", control, [
    "POST /api/repairdesk/buyback/quote/create",
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "en");
  await visibleButton(page, translateMessage("en", "buyback2b5.new")).click();
  const dialog = page.getByRole("dialog", {
    name: translateMessage("en", "buyback2b5.workspace.create"),
  });
  await dialog
    .getByRole("button", { name: translateMessage("en", "buyback2b5.workspace.save") })
    .click();
  const model = dialog.getByRole("textbox", {
    name: translateMessage("en", "buyback2b5.workspace.model"),
  });
  await expect(model).toBeFocused();
  await expect(model).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toContainText(
    translateMessage("en", "buyback2b5.validation.model"),
  );
  expect(control.createBodies).toEqual([]);
  await expectQuoteOnly(dialog);
  const blockedLocalPaths = [
    "/api/repairdesk/buyback/attachment/upload",
    "/api/repairdesk/buyback/evidence/upload",
    "/api/repairdesk/payments/create",
    "/api/repairdesk/inventory/buyback/finalize",
    "/api/repairdesk/buyback/legal/accept",
    "/api/repairdesk/messages/whatsapp",
    "/api/repairdesk/buyback/unknown-command",
  ];
  const consoleStart = evidence.consoleMessages.length;
  for (const path of blockedLocalPaths) await probeBlockedPost(page, `${baseOrigin}${path}`);
  const blockedExternal = "https://release2b5.invalid/api/repairdesk/buyback/quote/create";
  await probeBlockedPost(page, blockedExternal);
  const probeConsoleErrors = evidence.consoleMessages
    .splice(consoleStart)
    .filter((message) => message.startsWith("error:"));
  expect(
    probeConsoleErrors.every((message) =>
      /(?:ERR_BLOCKED_BY_CLIENT|Failed to load resource|Load failed)/u.test(message),
    ),
  ).toBe(true);
  await saveScreenshot(page, testInfo, "state-invalid-zero-write-en-390");
  await assertEvidence(page, evidence, [], {
    local: blockedLocalPaths.map((path) => `POST ${path}`),
    external: [`POST ${blockedExternal}`],
  });
});

test("pending create is same-click once, canonical, idempotent and synchronizes", async ({
  page,
}, testInfo) => {
  const control = createControl();
  const evidence = await preparePage(page, "en", control, [
    "POST /api/repairdesk/buyback/quote/create",
  ]);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "en");
  await visibleButton(page, translateMessage("en", "buyback2b5.new")).click();
  const dialog = page.getByRole("dialog", {
    name: translateMessage("en", "buyback2b5.workspace.create"),
  });
  await fillCanonicalDraft(dialog, "en");
  const save = dialog.getByRole("button", {
    name: translateMessage("en", "buyback2b5.workspace.save"),
  });
  await save.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect.poll(() => control.createBodies.length).toBe(1);
  await expect(save).toBeDisabled();
  await saveScreenshot(page, testInfo, "command-create-pending-en-1024");
  expectCanonicalCreate(control.createBodies[0]!);
  await control.pendingCreate[0]!.fulfill({ json: { data: commandResult("created") } });
  await expect(dialog).toBeHidden();
  await expectReadyList(page, "en");
  await saveScreenshot(page, testInfo, "command-create-success-en-1024");
  await assertEvidence(page, evidence, ["POST /api/repairdesk/buyback/quote/create"]);
});

test("revise conflict preserves draft, refreshes CAS and rotates idempotency", async ({
  page,
}, testInfo) => {
  const control = createControl({ reviseConflictOnce: true });
  const evidence = await preparePage(page, "it-IT", control, [
    "POST /api/repairdesk/buyback/quote/revise",
  ]);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "it-IT");
  await page.getByRole("button", { name: new RegExp(synthetic.publicNo) }).click();
  const detail = page.getByRole("dialog", { name: synthetic.itemLabel });
  const revise = detail.getByRole("button", {
    name: translateMessage("it-IT", "buyback2b5.detail.revise"),
  });
  await expect(revise).toBeEnabled();
  await revise.click();
  const workspace = page.getByRole("dialog", {
    name: translateMessage("it-IT", "buyback2b5.workspace.revise"),
  });
  await workspace
    .getByRole("textbox", {
      name: translateMessage("it-IT", "buyback2b5.workspace.screenDeduction"),
    })
    .fill("5");
  await workspace
    .getByRole("textbox", { name: translateMessage("it-IT", "buyback2b5.workspace.reason") })
    .fill(synthetic.draftReason);
  const save = workspace.getByRole("button", {
    name: translateMessage("it-IT", "buyback2b5.workspace.saveRevision"),
  });
  await save.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect.poll(() => control.reviseBodies.length).toBe(1);
  const first = normalizedCommand(control.reviseBodies[0]!);
  expect(first).toMatchObject({
    id: synthetic.recordId,
    input: { expected_updated_at: "2026-10-25T00:30:00.000Z" },
  });
  await expect(workspace.locator('[data-error-kind="conflict"]')).toBeVisible();
  await saveScreenshot(page, testInfo, "command-revise-conflict-it-IT-768");

  control.listItem = buybackItem({ updated_at: "2026-10-25T01:30:00.000Z" });
  await workspace
    .getByRole("button", { name: translateMessage("it-IT", "buyback2b5.detail.refresh") })
    .click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => control.reviseBodies.length).toBe(2);
  const second = normalizedCommand(control.reviseBodies[1]!);
  expect(second).toMatchObject({
    id: synthetic.recordId,
    input: { expected_updated_at: "2026-10-25T01:30:00.000Z" },
  });
  expect((second.input as Record<string, unknown>).quote).toEqual(
    (first.input as Record<string, unknown>).quote,
  );
  expect((control.reviseBodies[1]!.input as Record<string, unknown>).idempotency_key).not.toBe(
    (control.reviseBodies[0]!.input as Record<string, unknown>).idempotency_key,
  );
  await expect(workspace).toBeHidden();
  await assertEvidence(page, evidence, ["POST /api/repairdesk/buyback/quote/revise"]);
});

test("unknown response is confirmed by history readback without replay", async ({
  page,
}, testInfo) => {
  const control = createControl({ responseUnknownOnce: true });
  const evidence = await preparePage(page, "en", control, [
    "POST /api/repairdesk/buyback/quote/respond",
  ]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "en");
  await page.getByRole("button", { name: new RegExp(synthetic.publicNo) }).click();
  const detail = page.getByRole("dialog", { name: synthetic.itemLabel });
  await detail
    .getByRole("button", { name: translateMessage("en", "buyback2b5.detail.expand") })
    .click();
  await expect(detail).toContainText(synthetic.historyReason);
  await saveScreenshot(page, testInfo, "command-response-history-en-1280");
  await detail
    .getByRole("radio", { name: translateMessage("en", "buyback2b5.response.defer") })
    .click();
  const save = detail.getByRole("button", {
    name: translateMessage("en", "buyback2b5.detail.saveOutcome", {
      outcome: translateMessage("en", "buyback2b5.response.defer"),
    }),
  });
  await save.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect.poll(() => control.responseBodies.length).toBe(1);
  expectCanonicalResponse(control.responseBodies[0]!);
  await expect(detail).toBeHidden();
  expect(control.responseBodies).toHaveLength(1);
  expect(control.confirmedResponse).toBe(true);
  await saveScreenshot(page, testInfo, "command-response-readback-success-en-1280");
  await assertEvidence(page, evidence, ["POST /api/repairdesk/buyback/quote/respond"]);
});

test("real locale switches preserve URL search filter scroll and selection with zero business reads", async ({
  page,
}, testInfo) => {
  const control = createControl();
  const evidence = await preparePage(page, "en", control);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/buyback?view=compact", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "en");
  const search = page
    .getByRole("textbox", { name: translateMessage("en", "buyback2b5.search") })
    .first();
  await search.fill("Demo");
  await expect.poll(() => control.listBodies.at(-1)?.search).toBe("Demo");
  const filter = page
    .getByRole("combobox", { name: translateMessage("en", "buyback2b5.filter.label") })
    .first();
  await filter.click();
  await page
    .getByRole("option", { name: translateMessage("en", "buyback2b5.filter.awaiting") })
    .click();
  await page.evaluate(() => window.scrollTo(0, 20));
  const scroll = await page.evaluate(() => window.scrollY);
  const reads = evidence.allowedReads.length;
  await switchLocale(page, "it-IT");
  await switchLocale(page, "en");
  await expect(page).toHaveURL(`${baseOrigin}/buyback?view=compact`);
  await expect(search).toHaveValue("Demo");
  await expect(filter).toContainText(translateMessage("en", "buyback2b5.filter.awaiting"));
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(evidence.allowedReads).toHaveLength(reads);
  await saveScreenshot(page, testInfo, "locale-switch-preserved-en-1440");
  await assertEvidence(page, evidence, []);
});

test("authority replacement drops old open state and old projection", async ({
  page,
}, testInfo) => {
  const control = createControl();
  const evidence = await preparePage(page, "zh-CN", control);
  await page.setViewportSize({ width: 430, height: 844 });
  await page.goto("/buyback", { waitUntil: "domcontentloaded" });
  await expectReadyList(page, "zh-CN");
  await visibleButton(page, translateMessage("zh-CN", "buyback2b5.new")).click();
  await page
    .getByRole("dialog", { name: translateMessage("zh-CN", "buyback2b5.workspace.create") })
    .getByRole("textbox", { name: translateMessage("zh-CN", "buyback2b5.workspace.model") })
    .fill(synthetic.draftModel);
  control.state = "permission";
  control.listItem = buybackItem({
    id: "replacement-record",
    public_no: "BB-DEMO-252",
    item_label: "Replacement Device Ω",
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Replacement Device Ω", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(synthetic.draftModel);
  await expect(page.getByText(translateMessage("zh-CN", "buyback2b5.readOnly"))).toBeVisible();
  await saveScreenshot(page, testInfo, "authority-replacement-zh-CN-430");
  await assertEvidence(page, evidence, []);
});

function createControl(overrides: Partial<Control> = {}): Control {
  return {
    state: "ready",
    online: true,
    listItem: buybackItem(),
    listBodies: [],
    historyBodies: [],
    createBodies: [],
    reviseBodies: [],
    responseBodies: [],
    pendingList: [],
    pendingCreate: [],
    reviseConflictOnce: false,
    responseUnknownOnce: false,
    confirmedResponse: false,
    ...overrides,
  };
}

async function preparePage(
  page: Page,
  locale: AppLocale,
  control: Control,
  allowedWrites: string[] = [],
) {
  await page.context().addCookies([{ name: "repairdesk_locale", value: locale, url: baseURL }]);
  await page.addInitScript((online) => {
    const state = window as typeof window & {
      __release2b5Document?: string;
      __release2b5Unhandled?: string[];
    };
    state.__release2b5Document = "same-document";
    state.__release2b5Unhandled = [];
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
    window.addEventListener("unhandledrejection", (event) => {
      state.__release2b5Unhandled?.push(String(event.reason));
    });
  }, control.online);
  await installStatusBridge(page);
  await installFixtures(page, control);
  return installStrictGate(page, allowedWrites);
}

async function installStatusBridge(page: Page) {
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

async function installFixtures(page: Page, control: Control) {
  await page.route(apiUrl("shell/bootstrap"), async (route) => {
    if (control.state === "loading") return;
    await route.fulfill({ json: { data: shellBootstrapFixture(control) } });
  });
  await page.route(apiUrl("onboarding/status"), (route) =>
    route.fulfill({ json: { data: shellBootstrapFixture(control).onboarding } }),
  );
  await page.route(apiUrl("stores/context"), (route) =>
    route.fulfill({ json: { data: shellBootstrapFixture(control).storeContext } }),
  );
  await page.route(apiUrl("order-workflow"), (route) =>
    route.fulfill({ json: { data: { statuses: [], transitions: [] } } }),
  );
  await page.route(apiUrl("options"), (route) =>
    route.fulfill({ json: { data: { suppliers: [], technicians: [], permissions: {} } } }),
  );
  await page.route(apiUrl("kiosk/available-devices"), (route) =>
    route.fulfill({ json: { data: [] } }),
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
  await page.route(apiUrl("orders/queue-summary"), (route) =>
    route.fulfill({
      json: {
        data: {
          list: { items: [], total: 0, page: 1, pageSize: 20, pageCount: 0 },
          workflow: { statuses: [], transitions: [] },
          options: { suppliers: [], technicians: [], permissions: {} },
        },
      },
    }),
  );
  await page.route(apiUrl("customers/list-page"), (route) =>
    route.fulfill({
      json: {
        data: { items: [], total: 0, page: 1, pageSize: 30, pageCount: 0, tags: [], stats: {} },
      },
    }),
  );
  await page.route(apiUrl("inventory/list"), async (route) => {
    control.listBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (control.state === "loading") {
      control.pendingList.push(route);
      return;
    }
    if (control.state === "error") {
      await syntheticError(route, 503);
      return;
    }
    await route.fulfill({ json: { data: control.state === "empty" ? [] : [control.listItem] } });
  });
  await page.route(apiUrl("buyback/quote/history"), async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    control.historyBodies.push(body);
    const confirmed = control.responseUnknownOnce && control.responseBodies.length > 0;
    if (confirmed) control.confirmedResponse = true;
    await route.fulfill({
      json: {
        data: historyFixture(confirmed ? responseFromBody(control.responseBodies[0]!) : undefined),
      },
    });
  });
  await page.route(apiUrl("buyback/quote/create"), async (route) => {
    control.createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    control.pendingCreate.push(route);
  });
  await page.route(apiUrl("buyback/quote/revise"), async (route) => {
    control.reviseBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (control.reviseConflictOnce && control.reviseBodies.length === 1) {
      await syntheticError(route, 409);
      return;
    }
    await route.fulfill({ json: { data: commandResult("revised") } });
  });
  await page.route(apiUrl("buyback/quote/respond"), async (route) => {
    control.responseBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (control.responseUnknownOnce && control.responseBodies.length === 1) {
      await syntheticError(route, 503);
      return;
    }
    await route.fulfill({ json: { data: commandResult("response_recorded") } });
  });
}

async function syntheticError(route: Route, status: number) {
  await route.fulfill({
    status: 200,
    headers: { "x-repairdesk-test-status": String(status) },
    json: { error: synthetic.rawSentinel, code: "SYNTHETIC_FAILURE" },
  });
}

async function installStrictGate(page: Page, allowedWrites: string[]): Promise<Evidence> {
  const evidence: Evidence = {
    pageErrors: [],
    consoleMessages: [],
    forbiddenRequests: [],
    allowedReads: [],
    allowedWrites: [],
    blockedLocalWrites: [],
    blockedExternalRequests: [],
  };
  page.on("pageerror", (error) => evidence.pageErrors.push(error.message));
  page.on("console", (message) =>
    evidence.consoleMessages.push(`${message.type()}: ${message.text()}`),
  );
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    if (isAllowedRead(request)) {
      evidence.allowedReads.push(key);
      await route.fallback();
      return;
    }
    if (!isLoopback(url.hostname) || url.origin !== baseOrigin) {
      evidence.blockedExternalRequests.push(`${request.method()} ${request.url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (forbiddenSensitivePath.test(url.pathname)) {
      evidence.blockedLocalWrites.push(key);
      await route.abort("blockedbyclient");
      return;
    }
    if (commandPosts.has(url.pathname) && allowedWrites.includes(key)) {
      evidence.allowedWrites.push(key);
      await route.fallback();
      return;
    }
    if (isWriteMethod(request.method())) evidence.blockedLocalWrites.push(key);
    else evidence.forbiddenRequests.push(key);
    await route.abort("blockedbyclient");
  });
  return evidence;
}

function isAllowedRead(request: Request) {
  const url = new URL(request.url());
  if (url.protocol === "blob:") {
    const nestedOrigin = new URL(url.pathname).origin;
    return request.method() === "GET" && nestedOrigin === baseOrigin;
  }
  if (url.origin !== baseOrigin || !isLoopback(url.hostname)) return false;
  if (request.method() === "GET" || request.method() === "HEAD") {
    return (
      pagePaths.has(url.pathname) ||
      url.pathname.startsWith("/_next/") ||
      url.pathname === "/favicon.ico" ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname === "/__nextjs_font/geist-latin.woff2" ||
      readGets.has(url.pathname)
    );
  }
  if (request.method() !== "POST" || !readPosts.has(url.pathname)) return false;
  const body = safePostData(request);
  if (url.pathname === "/api/repairdesk/inventory/list") {
    return (
      isExactRecord(body, ["categories", "search", "sourceTypes"]) &&
      JSON.stringify((body as Record<string, unknown>).categories) === JSON.stringify(["phone"]) &&
      JSON.stringify((body as Record<string, unknown>).sourceTypes) ===
        JSON.stringify(["buyback"]) &&
      (!(body as Record<string, unknown>).search ||
        typeof (body as Record<string, unknown>).search === "string")
    );
  }
  if (url.pathname === "/api/repairdesk/buyback/quote/history") {
    return isExactRecord(body, ["id"]) && typeof (body as Record<string, unknown>).id === "string";
  }
  return true;
}

function safePostData(request: Request): unknown {
  try {
    return request.postDataJSON();
  } catch {
    return undefined;
  }
}

function isExactRecord(value: unknown, allowedKeys: string[]) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).every((key) => allowedKeys.includes(key))
  );
}

function isWriteMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

async function expectReadyList(page: Page, locale: AppLocale) {
  await expect(
    page
      .locator("h1")
      .filter({ hasText: translateMessage(locale, "buyback.title") })
      .first(),
  ).toBeAttached();
  await expect(page.locator('[data-buyback-list="true"]')).toBeVisible();
  await expect(page.getByText(synthetic.itemLabel, { exact: true })).toBeVisible();
}

async function fillCanonicalDraft(dialog: Locator, locale: AppLocale) {
  await dialog
    .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.model") })
    .fill(synthetic.draftModel);
  await dialog
    .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.color") })
    .fill(synthetic.draftColor);
  await dialog
    .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.battery") })
    .fill("87");
  await dialog
    .getByRole("textbox", {
      name: translateMessage(locale, "buyback2b5.workspace.screenDeduction"),
    })
    .fill("12.5");
  await dialog
    .getByRole("textbox", {
      name: translateMessage(locale, "buyback2b5.workspace.batteryDeduction"),
    })
    .fill("7.25");
  await dialog
    .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.finalOffer") })
    .fill("399.25");
  await expect(
    dialog.getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.reason") }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: translateMessage(locale, "buyback2b5.workspace.reason") })
    .fill(synthetic.draftReason);
}

function expectCanonicalCreate(body: Record<string, unknown>) {
  expect(Object.keys(body)).toEqual(["input"]);
  const input = body.input as Record<string, unknown>;
  expect(input.record_id).toMatch(UUID_V4);
  expect(input.idempotency_key).toMatch(UUID_V4);
  expect(input.device).toEqual({
    brand: "Apple",
    model: synthetic.draftModel,
    color: synthetic.draftColor,
    storage_capacity: "128GB",
    serial_or_imei: undefined,
    battery_health: 87,
  });
  expect(input.quote).toMatchObject({
    reference_low: 350,
    reference_high: 420,
    final_offer: 399.25,
    deductions: [
      { code: "screen", label: "屏幕状况调整", amount: 12.5 },
      { code: "battery", label: "电池健康调整", amount: 7.25 },
    ],
    manual_adjustment_reason: synthetic.draftReason,
    risk_level: "low",
    hard_block: false,
  });
  expect((input.quote as Record<string, unknown>).expires_at).toEqual(expect.any(String));
}

function expectCanonicalResponse(body: Record<string, unknown>) {
  expect(Object.keys(body)).toEqual(["id", "input"]);
  expect(body.id).toBe(synthetic.recordId);
  const input = body.input as Record<string, unknown>;
  expect(input.idempotency_key).toMatch(UUID_V4);
  expect(input).toEqual({
    expected_updated_at: "2026-10-25T00:30:00.000Z",
    quote_revision_id: synthetic.revisionId,
    outcome: "deferred",
    reason_code: undefined,
    note: undefined,
    idempotency_key: input.idempotency_key,
  });
}

function normalizedCommand(body: Record<string, unknown>) {
  return JSON.parse(
    JSON.stringify(body, (key, value) =>
      key === "idempotency_key" ? "<uuid>" : key === "expires_at" ? "<iso>" : value,
    ),
  ) as Record<string, unknown>;
}

function buybackItem(overrides: Partial<InventoryListItem> = {}): InventoryListItem {
  return {
    id: synthetic.recordId,
    public_no: synthetic.publicNo,
    status: "offer_made",
    source_type: "buyback",
    category: "phone",
    brand: synthetic.brand,
    model: synthetic.model,
    color: synthetic.color,
    storage_capacity: "256GB",
    identifier_kind: "imei1",
    serial_or_imei: synthetic.identifierTail,
    imei_check_status: "unchecked",
    activation_lock_status: "unchecked",
    data_wipe_status: "unchecked",
    cosmetic_grade: "good",
    functional_grade: "passed",
    battery_health: 87,
    buyback_price: 0,
    list_price: 0,
    sale_price: 0,
    deposit_amount: 0,
    repair_cost_amount: 0,
    fees_amount: 0,
    currency_code: "EUR",
    warranty_months: 0,
    legacy_payload: {
      buyback_quote: {
        reference_low: 350,
        reference_high: 420,
        final_offer: 400,
        deductions: [{ code: "screen", label: "Synthetic screen adjustment Ω", amount: 20 }],
        current_revision_id: synthetic.revisionId,
        intent_outcome: "undecided",
        risk_level: "low",
        hard_block: false,
        expires_at: "2026-10-28T01:30:00.000Z",
      },
    },
    created_at: "2026-10-24T00:30:00.000Z",
    updated_at: "2026-10-25T00:30:00.000Z",
    item_label: synthetic.itemLabel,
    profit: 0,
    ...overrides,
  };
}

function historyFixture(response?: Record<string, unknown>) {
  return {
    revisions: [
      {
        id: synthetic.revisionId,
        revision_no: 1,
        kind: "reprice",
        quote: {
          reference_low: 350,
          reference_high: 420,
          final_offer: 400,
          deductions: [],
          risk_level: "low",
          hard_block: false,
          expires_at: "2026-10-28T01:30:00.000Z",
        },
        change_reason: synthetic.historyReason,
        actor_name: synthetic.actor,
        created_at: "2026-10-25T00:30:00.000Z",
      },
    ],
    responses: response ? [response] : [],
  };
}

function responseFromBody(body: Record<string, unknown>) {
  const input = body.input as Record<string, unknown>;
  return {
    id: "response-release-2b5",
    quote_revision_id: input.quote_revision_id,
    outcome: input.outcome,
    reason_code: input.reason_code,
    note: input.note,
    channel: "staff_recorded_verbal",
    actor_name: synthetic.actor,
    created_at: "2026-10-25T01:00:00.000Z",
  };
}

function commandResult(code: "created" | "revised" | "response_recorded") {
  return {
    ok: true,
    code,
    item_id: synthetic.recordId,
    quote_revision_id: synthetic.revisionId,
    updated_at: "2026-10-25T01:30:00.000Z",
  };
}

function shellBootstrapFixture(control: Control) {
  const activeStore =
    control.state === "no-store"
      ? undefined
      : {
          id: synthetic.storeId,
          name: synthetic.storeName,
          slug: "synthetic-release-2b5",
          role: control.state === "permission" ? "viewer" : "owner",
          status: "active",
          membershipId: synthetic.membershipId,
        };
  return {
    onboarding: {
      userId: "user-release-2b5",
      displayName: synthetic.actor,
      isPlatformAdmin: false,
      activeStore,
      stores: activeStore ? [activeStore] : [],
      requests: [],
      availableStores: [],
    },
    storeContext: {
      activeStore,
      stores: activeStore ? [activeStore] : [],
      activeStoreExplicit: Boolean(activeStore),
      permissions: {
        canReadSuppliers: false,
        canAssignSuppliers: false,
        canManageSuppliers: false,
        canReadInventory: true,
        canCreateInventory: control.state !== "permission",
        canUpdateInventory: control.state !== "permission",
        canSellInventory: control.state !== "permission",
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

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    })),
  ).toEqual(
    expect.objectContaining({ scrollWidth: expect.any(Number), innerWidth: expect.any(Number) }),
  );
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

async function expectFooterReachable(dialog: Locator, kind: "workspace" | "detail") {
  const footer = dialog.locator(`[data-buyback-fixed-footer="${kind}"]`);
  await expect(footer).toBeVisible();
  const rect = await footer.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, viewportHeight: window.innerHeight };
  });
  expect(rect.top).toBeGreaterThanOrEqual(-1);
  expect(rect.bottom).toBeLessThanOrEqual(rect.viewportHeight + 1);
}

async function expectMobileInputFont(dialog: Locator) {
  const inputs = dialog.locator("input:visible, textarea:visible");
  for (let index = 0; index < (await inputs.count()); index += 1) {
    const size = await inputs
      .nth(index)
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  }
}

async function expectLongCopyNotClipped(root: Locator, locale: AppLocale) {
  if (locale !== "it-IT") return;
  const target = root.getByText(translateMessage(locale, "buyback2b5.quoteOnly"), { exact: true });
  await expect(target).toBeVisible();
  expect(
    await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.textOverflow === "ellipsis" || element.scrollWidth > element.clientWidth + 1;
    }),
  ).toBe(false);
}

async function expectQuoteOnly(root: Locator) {
  const text = (await root.innerText()).toLowerCase();
  expect(text).not.toMatch(
    /(?:upload evidence|carica prova|上传证据|whatsapp|firma digitale|digital signature)/u,
  );
  await expect(root.locator('input[type="file"]')).toHaveCount(0);
  await expect(
    root.getByRole("button", { name: /(?:pay|payment|pagamento|finalize|finalizza|支付|成交)/iu }),
  ).toHaveCount(0);
}

async function expectNoUnexpectedFixedHan(root: Locator, locale: AppLocale) {
  if (locale === "zh-CN") return;
  const offenders = await root.evaluate((element, dynamicValues) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const results: string[] = [];
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const text = node.textContent?.trim() ?? "";
      if (parent && text) {
        const style = getComputedStyle(parent);
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !parent.closest('[hidden], [aria-hidden="true"]')
        ) {
          const stripped = dynamicValues.reduce(
            (remaining, value) => remaining.split(value).join(""),
            text,
          );
          if (/[\u3400-\u9fff]/u.test(stripped)) results.push(stripped);
        }
      }
      node = walker.nextNode();
    }
    return [...new Set(results)];
  }, Object.values(synthetic));
  expect(offenders).toEqual([]);
}

async function switchLocale(page: Page, locale: AppLocale) {
  const trigger = page.locator('[data-language-switcher-trigger="true"]:visible').first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const option = page.getByRole("menuitemradio", { name: localeDisplayNames[locale] });
  await option.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __release2b5Document?: string }).__release2b5Document,
    ),
  ).toBe("same-document");
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const engine = testInfo.project.name.includes("webkit") ? "webkit" : "chromium";
  await page.screenshot({
    path: resolve(process.cwd(), "screenshots", "release2b5", engine, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function assertEvidence(
  page: Page,
  evidence: Evidence,
  expectedWrites: string[],
  expectedBlocked: { local: string[]; external: string[] } = { local: [], external: [] },
) {
  expect(evidence.pageErrors).toEqual([]);
  expect(evidence.forbiddenRequests).toEqual([]);
  expect(evidence.blockedLocalWrites).toEqual(expectedBlocked.local);
  expect(evidence.blockedExternalRequests).toEqual(expectedBlocked.external);
  expect([...new Set(evidence.allowedWrites)]).toEqual(expectedWrites);
  expect(evidence.consoleMessages.filter((message) => message.startsWith("error:"))).toEqual([]);
  const unhandled = await page.evaluate(
    () =>
      (window as typeof window & { __release2b5Unhandled?: string[] }).__release2b5Unhandled ?? [],
  );
  expect(unhandled).toEqual([]);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain(synthetic.rawSentinel);
  expect(body).not.toMatch(fullImei);
  expect(body).not.toMatch(email);
  expect(body).not.toMatch(documentNumber);
  expect(body).not.toMatch(visibleUrl);
  expect(body).not.toMatch(/(?:signature hash|internal cost|raw sentinel)/iu);
}

async function probeBlockedPost(page: Page, url: string) {
  await page.evaluate(async (target) => {
    await fetch(target, { method: "POST", mode: "no-cors", body: "{}" }).catch(() => undefined);
  }, url);
}

function visibleButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
}

function newQuoteCandidate(page: Page, locale: AppLocale) {
  return visibleButton(page, translateMessage(locale, "buyback2b5.new"));
}

async function expectCriticalTouchTarget(target: Locator) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

function apiUrl(path: string) {
  return `${baseOrigin}/api/repairdesk/${path}`;
}

function viewportHeight(width: number) {
  if (width <= 430) return 844;
  if (width === 768) return 1024;
  return 900;
}
