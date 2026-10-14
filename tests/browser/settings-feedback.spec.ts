import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { defaultStoreSettings } from "../../lib/store-settings";
const settingsKey = "chinatech.m1.store-settings.v1";
const staffKey = "chinatech.m1.staff.v1";
type FinanceDiagnostic = { phase: string; events: Record<string, unknown>[]; originalSetItem: typeof Storage.prototype.setItem; instrumentedSetItem: typeof Storage.prototype.setItem; record: (value: Record<string, unknown>) => void };
type DiagnosticWindow = typeof window & { restoreSettingsStorage?: () => void; financeDiagnostic?: FinanceDiagnostic };
async function openSettings(page: Page, tab: string) {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.addInitScript(({ key, settings }) => { if (!localStorage.getItem("settings-feedback-seeded")) { localStorage.setItem("settings-feedback-seeded", "1"); localStorage.setItem(key, JSON.stringify({ version: 1, settings })); } }, { key: settingsKey, settings: defaultStoreSettings });
  await page.goto("/app/settings");
  if (tab !== "门店设置") await page.getByRole("navigation", { name: "门店管理分类" }).getByRole("button", { name: tab, exact: true }).click();
}
async function failWrites(page: Page, key: string) {
  await page.evaluate(key => {
    const view = window as DiagnosticWindow;
    const original = Storage.prototype.setItem;
    view.restoreSettingsStorage = () => { Storage.prototype.setItem = original; view.financeDiagnostic?.record({ type: "restore", matchesInstrumentedOriginal: original === view.financeDiagnostic.instrumentedSetItem, restoredExact: Storage.prototype.setItem === original }); };
    Storage.prototype.setItem = function (this: Storage, name, value) {
      if (name === key) { view.financeDiagnostic?.record({ type: "synthetic-storage-rejection", key: name }); throw new DOMException("DEMO synthetic storage failure", "QuotaExceededError"); }
      return original.call(this, name, value);
    };
  }, key);
}
async function restoreWrites(page: Page) { await page.evaluate(() => (window as typeof window & { restoreSettingsStorage?: () => void }).restoreSettingsStorage?.()); }

async function installFinanceDiagnostics(page: Page) {
  await page.evaluate(key => {
    const view = window as DiagnosticWindow;
    const events: Record<string, unknown>[] = [];
    const originalSetItem = Storage.prototype.setItem;
    const record = (value: Record<string, unknown>) => { if (events.length < 250) events.push({ time: performance.now(), phase: view.financeDiagnostic?.phase, ...value }); };
    const instrumentedSetItem: typeof Storage.prototype.setItem = function (this: Storage, name, value) {
      if (name !== key) return originalSetItem.call(this, name, value);
      let revision: unknown, count: unknown;
      try { const data = JSON.parse(value); revision = data.settings?.revision; count = data.settings?.finance?.length; } catch { /* Only record counts, never the stored payload. */ }
      record({ type: "native-storage-call", key: name, revision, count });
      try { const result = originalSetItem.call(this, name, value); record({ type: "native-storage-return", key: name }); return result; }
      catch (error) { record({ type: "native-storage-error", key: name, error: error instanceof Error ? error.name : "unknown" }); throw error; }
    };
    view.financeDiagnostic = { phase: "registration-first", events, originalSetItem, instrumentedSetItem, record };
    Storage.prototype.setItem = instrumentedSetItem;
    for (const capture of [true, false]) for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "submit", "invalid"]) {
      document.addEventListener(type, event => {
        if (!(event.target instanceof Element) || !event.target.closest(".settings-content")) return;
        const target = event.target;
        const input = event as MouseEvent;
        const submitter = event instanceof SubmitEvent ? event.submitter : null;
        const button = document.querySelector<HTMLButtonElement>(".settings-editor button[type=submit]");
        const rectangle = button?.getBoundingClientRect();
        const content = document.querySelector(".settings-content");
        const globalError = document.querySelector(".settings-content > .form-error")?.getBoundingClientRect();
        const localError = document.querySelector(".settings-editor .form-error")?.getBoundingClientRect();
        record({ type: "native-event", event: type, capture, target: target.tagName, label: target.getAttribute("aria-label"), detail: input.detail, trusted: event.isTrusted, defaultPrevented: event.defaultPrevented, submitter: submitter?.textContent, x: input.clientX, y: input.clientY, scrollY: window.scrollY, buttonRect: rectangle ? { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, bottom: rectangle.bottom } : null, overflowAnchorSupported: CSS.supports("overflow-anchor", "none"), rootOverflowAnchor: getComputedStyle(document.documentElement).getPropertyValue("overflow-anchor"), contentOverflowAnchor: content ? getComputedStyle(content).getPropertyValue("overflow-anchor") : null, globalErrorRect: globalError ? { y: globalError.y, height: globalError.height } : null, localErrorRect: localError ? { y: localError.y, height: localError.height } : null, buttonDisabled: button?.matches(":disabled"), formBusy: button?.form?.getAttribute("aria-busy"), mainBusy: document.querySelector(".settings-page")?.getAttribute("aria-busy") });
      }, capture);
    }
  }, settingsKey);
}

async function financeCheckpoint(page: Page, phase: string) {
  await page.evaluate(phase => {
    const diagnostic = (window as DiagnosticWindow).financeDiagnostic;
    if (!diagnostic) return;
    diagnostic.phase = phase;
    const form = document.querySelector<HTMLFormElement>(".settings-editor");
    const button = form?.querySelector<HTMLButtonElement>("button[type=submit]");
    const rectangle = button?.getBoundingClientRect();
    const content = document.querySelector(".settings-content");
    const globalError = document.querySelector(".settings-content > .form-error")?.getBoundingClientRect();
    const localError = document.querySelector(".settings-editor .form-error")?.getBoundingClientRect();
    diagnostic.record({ type: "checkpoint", phase, instrumentedStorageActive: Storage.prototype.setItem === diagnostic.instrumentedSetItem, scrollY: window.scrollY, buttonRect: rectangle ? { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, bottom: rectangle.bottom } : null, overflowAnchorSupported: CSS.supports("overflow-anchor", "none"), rootOverflowAnchor: getComputedStyle(document.documentElement).getPropertyValue("overflow-anchor"), contentOverflowAnchor: content ? getComputedStyle(content).getPropertyValue("overflow-anchor") : null, globalErrorRect: globalError ? { y: globalError.y, height: globalError.height } : null, localErrorRect: localError ? { y: localError.y, height: localError.height } : null, buttonText: button?.textContent, buttonDisabled: button?.matches(":disabled"), fieldsetDisabled: form?.querySelector("fieldset")?.hasAttribute("disabled"), formBusy: form?.getAttribute("aria-busy"), mainBusy: document.querySelector(".settings-page")?.getAttribute("aria-busy"), fields: Array.from(form?.querySelectorAll<HTMLInputElement>("input") ?? [], field => ({ label: field.getAttribute("aria-label"), valueLength: field.value.length, valid: field.validity.valid, valueMissing: field.validity.valueMissing, customError: field.validity.customError, typeMismatch: field.validity.typeMismatch, disabled: field.matches(":disabled") })) });
  }, phase);
}

async function dumpFinanceDiagnostics(page: Page, testInfo: TestInfo) {
  await financeCheckpoint(page, "failure");
  const result = await page.evaluate(key => {
    const diagnostic = (window as DiagnosticWindow).financeDiagnostic;
    let revision: unknown, count: unknown, storageReadError: unknown;
    try { const raw = localStorage.getItem(key); const data = raw ? JSON.parse(raw) : null; revision = data?.settings?.revision; count = data?.settings?.finance?.length; }
    catch (error) { storageReadError = error instanceof Error ? error.name : "unknown"; }
    const events = diagnostic?.events ?? [];
    return { platform: navigator.platform, userAgent: navigator.userAgent, key, revision, count, storageReadError, events, summary: { clicks: events.filter(event => event.type === "native-event" && event.event === "click" && event.capture).length, submits: events.filter(event => event.type === "native-event" && event.event === "submit" && event.capture).length, invalid: events.filter(event => event.type === "native-event" && event.event === "invalid" && event.capture).length, syntheticRejections: events.filter(event => event.type === "synthetic-storage-rejection").length, nativeStorageCalls: events.filter(event => event.type === "native-storage-call").length, nativeStorageReturns: events.filter(event => event.type === "native-storage-return").length, nativeStorageErrors: events.filter(event => event.type === "native-storage-error").length } };
  }, settingsKey);
  const body = JSON.stringify(result, null, 2);
  console.log("FINANCE_RETRY_DIAGNOSTICS " + JSON.stringify(result));
  await testInfo.attach("finance-retry-diagnostics", { body, contentType: "application/json" });
}

test("settings failure retains input and success clears feedback with the saved revision", async ({ page }) => {
  await openSettings(page, "门店设置"); const field = page.getByRole("textbox", { name: "门店名称", exact: true });
  await field.fill("DEMO 设置恢复"); await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.locator(".settings-content").getByRole("alert")).toContainText("本地保存失败"); await expect(field).toHaveValue("DEMO 设置恢复");
  await expect(page.getByRole("navigation", { name: "门店管理分类" }).getByRole("button", { name: "打印", exact: true })).toBeEnabled();
  await restoreWrites(page); await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.locator(".settings-saved")).toHaveText("已保存"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保留输入并核对最新版本", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "保存设置", exact: true }).click();
  await expect(page.getByRole("button", { name: "保留输入并核对最新版本", exact: true })).toHaveCount(0);
  await page.reload(); await expect(field).toHaveValue("DEMO 设置恢复");
});

test("supplier failure preserves status and success closes the editor", async ({ page }) => {
  await openSettings(page, "供应商"); await page.getByRole("button", { name: "新增", exact: true }).click();
  const name = page.getByRole("textbox", { name: "供应商名称", exact: true }); await name.fill("DEMO 供应商恢复");
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存供应商", exact: true }).click();
  await expect(name).toHaveValue("DEMO 供应商恢复"); await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toBeVisible();
  await restoreWrites(page); await page.getByRole("button", { name: "保存供应商", exact: true }).click();
  await expect(name).toHaveCount(0); await expect(page.locator(".settings-supplier-list")).toContainText("DEMO 供应商恢复"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
});

test("financial registration and void failure retain drafts and settle once after retry", async ({ page }, testInfo) => {
  try {
  await openSettings(page, "经营收支"); await page.getByRole("button", { name: "登记", exact: true }).click();
  await page.getByRole("textbox", { name: "收支金额", exact: true }).fill("25.50"); const purpose = page.getByRole("textbox", { name: "收支用途", exact: true }); await purpose.fill("DEMO 收支恢复");
  await installFinanceDiagnostics(page);
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "保存登记", exact: true }).click();
  await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toHaveText("本地保存失败，现有资料未改变。"); await expect(purpose).toHaveValue("DEMO 收支恢复"); await expect(page.getByRole("button", { name: "保存登记", exact: true })).toBeEnabled(); await restoreWrites(page); await financeCheckpoint(page, "registration-retry"); await page.getByRole("button", { name: "保存登记", exact: true }).click();
  await expect(purpose).toHaveCount(0); await expect(page.locator(".settings-finance-list article")).toHaveCount(1);
  await page.getByRole("button", { name: "作废收支 DEMO 收支恢复", exact: true }).click(); const reason = page.getByRole("textbox", { name: "收支作废原因", exact: true }); await reason.fill("DEMO 更正误记");
  await financeCheckpoint(page, "void-first");
  await failWrites(page, settingsKey); await page.getByRole("button", { name: "确认作废", exact: true }).click(); await expect(page.locator(".settings-content").getByRole("alert").filter({ hasText: "本地保存失败" })).toHaveText("本地保存失败，现有资料未改变。"); await expect(reason).toHaveValue("DEMO 更正误记"); await expect(page.getByRole("button", { name: "确认作废", exact: true })).toBeEnabled();
  await restoreWrites(page); await financeCheckpoint(page, "void-retry"); await page.getByRole("button", { name: "确认作废", exact: true }).click(); await expect(reason).toHaveCount(0); await expect(page.locator(".settings-finance-list article")).toHaveCount(1); await expect(page.locator(".settings-finance-list")).toContainText("已作废"); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0);
  } catch (error) {
    await dumpFinanceDiagnostics(page, testInfo).catch(reason => console.log("FINANCE_DIAGNOSTIC_CAPTURE_FAILED " + String(reason)));
    throw error;
  }
});

test("employee storage rejection preserves reviewed permissions and success closes the editor", async ({ page }) => {
  await openSettings(page, "员工设置"); await page.getByRole("button", { name: "新增员工", exact: true }).click();
  await page.getByRole("textbox", { name: "员工称呼", exact: true }).fill("DEMO 员工恢复"); await page.getByRole("textbox", { name: "员工账号标识", exact: true }).fill("settings-feedback@demo.chinatech.local");
  await page.getByRole("button", { name: "继续核对权限", exact: true }).click(); await failWrites(page, staffKey); await page.getByRole("button", { name: "确认保存员工", exact: true }).click();
  await expect(page.getByRole("heading", { name: "核对员工与权限", exact: true })).toBeVisible(); await expect(page.locator(".settings-content").getByRole("alert")).toContainText("员工预览保存失败");
  await restoreWrites(page); await page.getByRole("button", { name: "确认保存员工", exact: true }).click(); await expect(page.getByRole("heading", { name: "核对员工与权限", exact: true })).toHaveCount(0); await expect(page.locator(".settings-content").getByRole("alert")).toHaveCount(0); await expect(page.getByText("DEMO 员工恢复", { exact: true }).first()).toBeVisible();
});
