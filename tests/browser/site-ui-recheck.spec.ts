import { test, expect, type Page } from "@playwright/test";
import { mountSiteUIOffline, offlineCall, type OfflineSnapshot } from "./helpers/site-ui-offline";
import { translate } from "../../lib/i18n/translate";
import { emptyIntakeServices } from "../../lib/intake-services";
import type { IntakeReceiptData } from "../../lib/repair-intake-record";
import { customerId } from "../../lib/customers";
import { procurementRecords } from "../../lib/procurement-fixtures";
import { installColorPickerObservation, shouldObserveColorPicker } from "./helpers/color-picker-observation";

const colorObservations = new WeakMap<Page, Awaited<ReturnType<typeof installColorPickerObservation>>>();
test.beforeEach(async ({ page }, testInfo) => {
  if (shouldObserveColorPicker(testInfo)) colorObservations.set(page, await installColorPickerObservation(page, testInfo));
});
test.afterEach(async ({ page }) => {
  const observation = colorObservations.get(page);
  if (observation) { colorObservations.delete(page); await observation.finish(); }
});

const pending = { pending: { command: { requestId: "request-original", version: 7, payload: { note: "DEMO immutable original", value: 0 } } }, busy: false, message: "提交结果待核对" };
const snapshot = (page: Page) => page.evaluate(() => window.adapter.snapshot());

test("@offline recovery ownership follows actual rendered hosts and preserves original receipt lifetime", async ({ page }) => {
  const proof = await mountSiteUIOffline(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await offlineCall(page, "mount", "recovery", "location", true);
  await offlineCall(page, "setRecovery", pending);
  async function owner(where: string, excludedBy?: "aria-hidden" | "inert") {
    // CSS visibility and semantic availability differ for aria-hidden/inert.
    // Sample both owners together, so one RAF handoff cannot satisfy two waits
    // with different presentation states. Native hidden/details/media cases
    // still require exactly one visually rendered recovery host.
    await expect.poll(() => page.locator("[data-operation-recovery]:visible").evaluateAll(hosts => {
      // WebKit's Playwright :visible fallback checks only the nearest details.
      // A still-open inner details must not make a closed outer body painted.
      const rendered = hosts.filter(host => !host.closest("details:not([open])")).map(host => ({
        owner: host.closest("#global") ? "global" : host.closest("#desktop") ? "desktop" : "unexpected",
        ariaHidden: Boolean(host.closest('[aria-hidden="true"]')),
        inert: Boolean(host.closest("[inert]")),
        enabledActions: Array.from(host.querySelectorAll("button")).filter(button => !button.disabled).length,
      }));
      const available = rendered.filter(host => !host.ariaHidden && !host.inert);
      return {
        visualOwners: rendered.map(host => host.owner).sort(),
        availableOwners: available.map(host => host.owner).sort(),
        availableActions: available.map(host => host.enabledActions),
        excluded: rendered.filter(host => host.ariaHidden || host.inert).map(({ owner, ariaHidden, inert }) => ({ owner, ariaHidden, inert })),
      };
    })).toEqual({
      visualOwners: excludedBy ? ["desktop", "global"] : [where],
      availableOwners: [where],
      availableActions: [3],
      excluded: excludedBy ? [{ owner: "desktop", ariaHidden: excludedBy === "aria-hidden", inert: excludedBy === "inert" }] : [],
    });
    // Check ARIA exclusion through its role query. Its layout approximation can
    // retain inert/outer-closed-details descendants, so those native behaviors
    // get focus checks below. aria-hidden does not hide pixels or block focus.
    if (excludedBy === "aria-hidden") await expect(page.getByRole("button", { name: "核对提交结果", exact: true })).toHaveCount(1);
    await expect(page.locator(`#${where}`).getByRole("button", { name: "核对提交结果", exact: true })).toBeEnabled();
    expect((await snapshot(page)).recovery.pending?.command).toEqual(pending.pending.command);
    expect((await snapshot(page)).calls).toEqual([]);
  }
  await owner("desktop");
  for (const attr of ["hidden", "aria-hidden", "inert"] as const) {
    await page.locator("#tab").evaluate((element, name) => element.setAttribute(name, name === "aria-hidden" ? "true" : ""), attr);
    await owner("global", attr === "hidden" ? undefined : attr);
    if (attr === "inert") expect(await page.locator("#desktop button").evaluateAll(buttons => buttons.every(button => {
      (button as HTMLElement).focus();
      return document.activeElement !== button;
    }))).toBe(true);
    await page.locator("#tab").evaluate((element, name) => element.removeAttribute(name), attr);
    await owner("desktop");
  }
  for (const id of ["outer", "inner"]) {
    await page.locator(`#${id}`).evaluate(element => element.removeAttribute("open")); await owner("global");
    expect(await page.locator("#desktop button").evaluateAll(buttons => buttons.every(button => {
      (button as HTMLElement).focus();
      return document.activeElement !== button;
    }))).toBe(true);
  }
  await page.locator("#outer").evaluate(element => element.setAttribute("open", "")); await owner("global");
  await page.locator("#inner").evaluate(element => element.setAttribute("open", "")); await owner("desktop");
  for (const width of [767, 768, 390, 375, 1440]) { await page.setViewportSize({ width, height: 900 }); await owner(width < 768 ? "global" : "desktop"); }
  await page.locator("#desktop").evaluate(element => element.style.marginTop = "2000px"); await owner("desktop");
  await page.locator("#desktop").evaluate(element => element.style.marginTop = "0px");
  await offlineCall(page, "switchHost", false); await owner("global");
  await offlineCall(page, "switchHost", true); await owner("desktop");
  await offlineCall(page, "switchId", "other-request");
  await expect(page.locator("#global [data-operation-recovery]:visible")).toHaveCount(1);
  await offlineCall(page, "switchId", "request-original"); await owner("desktop");
  await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "false");
  await page.locator("#tab").evaluate(element => (element as HTMLElement).hidden = true); await owner("global");
  await page.locator("#global button").first().evaluate(element => { (element as HTMLElement).click(); (element as HTMLElement).click(); });
  await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "true");
  await page.locator("#tab").evaluate(element => (element as HTMLElement).hidden = false);
  await expect(page.locator("#desktop [data-operation-recovery]:visible")).toHaveCount(1);
  expect((await snapshot(page)).calls).toMatchObject([{ action: "check", requestId: "request-original", command: pending.pending.command }]);
  expect((await snapshot(page)).calls).toHaveLength(1);
  await offlineCall(page, "resolveRecovery");
  await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "false");
  await page.evaluate(() => { window.adapter.completed = 0; window.adapter.cleanup = () => new Promise<void>(resolve => { window.adapter.finishCleanup = resolve; }); window.adapter.watch(); });
  await offlineCall(page, "setRecovery", { ...pending, receipt: { requestId: "unrelated" } });
  await expect(page.locator("[data-receipt]")).toHaveAttribute("data-id", "request-original");
  await offlineCall(page, "setRecovery", { pending: null, busy: false, message: "提交已确认保存。", receipt: { requestId: "request-original" } });
  await expect(page.locator("[data-receipt]")).toHaveAttribute("data-waiting", "true");
  expect(await page.locator("[data-receipt]").getAttribute("data-id")).toBeNull();
  await offlineCall(page, "switchIdentity", 2);
  await page.evaluate(() => window.adapter.finishCleanup());
  expect(await page.evaluate(() => window.adapter.completed)).toBe(0);
  await offlineCall(page, "unmount");
  await expect.poll(() => page.evaluate(() => window.offlineStats().activeFrames)).toBe(0);
  expect(await page.evaluate(() => window.offlineStats())).toMatchObject({ observers: 0, resizeObservers: 0, activeFrames: 0 });
  expect((await snapshot(page)).subscribers).toBe(0);
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

test("@offline visibility batches scan only registered hosts once and become idle without state publications", async ({ page }) => {
  const proof = await mountSiteUIOffline(page);
  const measured = await page.evaluate(async () => {
    const counts: Record<string, number>[] = [], reads: number[] = [];
    const registry = window.adapter.createRegistry(next => counts.push(next));
    const hosts = Array.from({ length: 3 }, (_, index) => { const element = document.createElement("section"); element.textContent = `registered-${index}`; document.body.append(element); const original = element.getClientRects.bind(element); element.getClientRects = () => { reads.push(index); return original(); }; return element; });
    const cleanups = hosts.map((element, index) => registry.register(`scheduler-${index}`, element));
    await new Promise(resolve => setTimeout(resolve, 80));
    const start = window.offlineStats(), published = counts.length; reads.length = 0;
    for (let index = 0; index < 25; index++) { hosts[0].className = `batch-${index}`; hosts[1].setAttribute("data-open", String(index)); window.dispatchEvent(new Event("resize")); }
    await new Promise(resolve => setTimeout(resolve, 80));
    const batch = window.offlineStats(), batchReads = reads.length;
    await new Promise(resolve => setTimeout(resolve, 80));
    const idle = window.offlineStats();
    const result = { registeredHosts: hosts.length, rafForBatch: batch.rafScheduled - start.rafScheduled, batchReads, additionalIdleRAF: idle.rafScheduled - batch.rafScheduled, additionalPublishes: counts.length - published };
    cleanups.forEach(stop => stop()); registry.dispose(); hosts.forEach(element => element.remove()); return result;
  });
  expect(measured).toEqual({ registeredHosts: 3, rafForBatch: 1, batchReads: 3, additionalIdleRAF: 0, additionalPublishes: 0 });
  await expect.poll(() => page.evaluate(() => window.offlineStats().activeFrames)).toBe(0);
  expect(await page.evaluate(() => window.offlineStats())).toMatchObject({ observers: 0, resizeObservers: 0 });
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

for (const field of ["location", "color"] as const) test(`@offline retail ${field} freezes draft through pending, unknown and exact receipt cleanup`, async ({ page }) => {
  const proof = await mountSiteUIOffline(page);
  await offlineCall(page, "mount", "editor", field, false);
  const input = page.getByRole("textbox", { name: field === "location" ? "存放位置" : "颜色", exact: true });
  await input.fill(`DEMO frozen ${field}`);
  await page.getByRole("button", { name: "继续确认", exact: true }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await expect(page.getByRole("button", { name: "正在保存", exact: true })).toHaveAttribute("aria-busy", "true");
  await offlineCall(page, "setUnits", [{ ...(await page.evaluate(() => window.adapter.unit)), version: 2 }]);
  const rebase = page.getByRole("button", { name: "保留输入并核对最新版本", exact: true });
  await expect(rebase).toBeDisabled();
  const frozen = await snapshot(page);
  await rebase.evaluate(element => (element as HTMLElement).click());
  await page.evaluate(() => { window.adapter.restoreDraft({ value: "late restore", raw: "late", note: "late", version: 9, before: "late" }); window.adapter.delayedControl?.("late callback"); });
  expect((await snapshot(page)).draft).toEqual(frozen.draft);
  const command = frozen.calls.find(row => row.action === "save")!;
  await offlineCall(page, "setRecovery", { pending: { command: { requestId: command.requestId, ...command.payload } }, busy: false, message: "提交结果待核对" });
  await offlineCall(page, "resolveDispatch", false);
  const waiting = page.getByRole("button", { name: "待核对", exact: true });
  await expect(waiting).toBeDisabled(); await expect(waiting).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "false");
  await expect(rebase).toBeDisabled();
  expect(await page.locator("[data-operation-recovery] button").first().evaluate(element => element.closest("fieldset") !== null)).toBe(false);
  expect((await snapshot(page)).draft).toEqual(frozen.draft);
  await page.evaluate(() => window.adapter.deferredClear = true);
  await offlineCall(page, "setRecovery", { pending: null, busy: false, message: "提交已确认保存。", receipt: { requestId: command.requestId } });
  await expect(waiting).toBeDisabled(); expect((await snapshot(page)).closes).toBe(0);
  await offlineCall(page, "resolveClear");
  await expect.poll(async () => (await snapshot(page)).closes).toBe(1);
  expect((await snapshot(page)).calls.filter(row => row.action === "save")).toEqual([command]);
  await offlineCall(page, "unmount");
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

for (const status of ["cancelled", "rejected"] as const) test(`@offline explicit ${status} resolution unlocks retained retail input for a later manual rebase`, async ({ page }) => {
  const proof = await mountSiteUIOffline(page);
  await offlineCall(page, "mount", "editor", "location", false);
  await page.getByRole("textbox", { name: "存放位置", exact: true }).fill("DEMO retained after cancellation");
  await page.getByRole("button", { name: "继续确认", exact: true }).click();
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  const before: OfflineSnapshot = await snapshot(page), command = before.calls.find(row => row.action === "save")!;
  await offlineCall(page, "setUnits", [{ ...(await page.evaluate(() => window.adapter.unit)), version: 2 }]);
  await offlineCall(page, "setRecovery", { pending: { command: { requestId: command.requestId, ...command.payload } }, busy: false, message: "提交结果待核对" });
  await offlineCall(page, "resolveDispatch", false);
  const rebase = page.getByRole("button", { name: "保留输入并核对最新版本", exact: true });
  await expect(rebase).toBeDisabled();
  await offlineCall(page, "setRecovery", { pending: null, busy: false, message: status === "cancelled" ? "此提交已撤销，服务器不会再执行它；输入草稿仍可重新核对。" : "DEMO rejected original request", resolution: { requestId: command.requestId, status } });
  await expect(rebase).toBeEnabled(); expect((await snapshot(page)).closes).toBe(0);
  await rebase.click();
  await expect(page.getByRole("textbox", { name: "存放位置", exact: true })).toHaveValue("DEMO retained after cancellation");
  await page.getByRole("button", { name: "继续确认", exact: true }).click();
  expect((await snapshot(page)).calls.filter(row => row.action === "save")).toHaveLength(1);
  await offlineCall(page, "unmount");
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

test("@offline missing pending read controls remain measurable and suppress duplicate global notice", async ({ page }) => {
  const proof = await mountSiteUIOffline(page); await page.setViewportSize({ width: 1440, height: 900 });
  await offlineCall(page, "mount", "recovery", "location", true);
  await offlineCall(page, "setRecovery", { pending: null, busy: false, message: "DEMO recovery must be read" });
  await expect(page.locator("#desktop [data-operation-recovery]:visible")).toHaveCount(1);
  await expect(page.locator("#global .sync-recovery:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "重新读取恢复记录", exact: true }).press("Enter");
  expect((await snapshot(page)).calls).toEqual([{ action: "read" }]);
  await offlineCall(page, "unmount");
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

test("@offline retry and cancellation use the original ID and real busy through local/global handoff", async ({ page }) => {
  const proof = await mountSiteUIOffline(page); await page.setViewportSize({ width: 1440, height: 900 });
  for (const [label, action] of [["重试原提交", "retry"], ["撤销未完成提交", "cancel"]]) {
    await offlineCall(page, "reset"); await offlineCall(page, "mount", "recovery", "location", true);
    await offlineCall(page, "setRecovery", pending);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator("#desktop button[aria-busy=true]")).toHaveCount(1);
    await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "true");
    await page.locator("#tab").evaluate(element => element.setAttribute("hidden", ""));
    await expect(page.locator("#global [data-operation-recovery]:visible")).toHaveCount(1);
    expect((await snapshot(page)).calls).toMatchObject([{ action, requestId: "request-original", command: pending.pending.command }]);
    expect((await snapshot(page)).calls).toHaveLength(1);
    await offlineCall(page, "resolveRecovery");
    await expect(page.locator("[data-content-progress]")).toHaveAttribute("data-active", "false");
    await offlineCall(page, "unmount");
  }
  expect(proof).toEqual({ requests: [], errors: [], consoleErrors: [] });
});

// The following cases are actual routed preview-page tests for normal CI. They
// are deliberately separate from the offline fake-backend assertions above.
for (const locale of ["zh-CN", "it", "en"] as const) test(`routed customer and procurement navigation retains one real pending slot (${locale})`, async ({ page }) => {
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
  await page.addInitScript(locale => localStorage.setItem("chinatech.language", locale), locale);
  if (locale === "it") await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of locale === "zh-CN" ? [1440, 1024, 390, 375] : [375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const area of ["customers", "procurement"] as const) {
      await page.goto(`/app/${area}`);
      const row = area === "procurement" ? page.locator("main .procurement-row").first() : page.locator(`main a[href^="/app/${area}/"]`).filter({ has: page.locator(".navigation-feedback") }).first();
      await expect(row).toBeVisible();
      const href = (await row.getAttribute("href"))!;
      if (area === "procurement") {
        expect(href).not.toBe("/app/procurement/new");
        expect(procurementRecords.map(record => `/app/procurement/${record.id}`)).toContain(href);
      }
      const slot = row.locator(":scope > .navigation-feedback");
      await expect(slot).toBeVisible(); const before = await slot.boundingBox();
      let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**${href}?*`, async route => { if (route.request().headers()["rsc"] !== "1") return route.continue(); const response = await route.fetch(); await gate; await route.fulfill({ response }); });
      try {
        const title = page.locator("main").getByRole("heading", { level: 2, name: translate(area === "customers" ? "客户管理" : "采购与到货", locale), exact: true });
        await expect(title).toHaveCount(1);
        await expect(title).toBeVisible();
        const heading = await title.textContent();
        await row.press("Enter");
        await expect(slot).toHaveAttribute("data-pending", "true");
        await expect(slot.locator("svg.spin")).toHaveCount(1);
        await expect(page.locator('main .navigation-feedback[data-pending="true"]')).toHaveCount(1);
        await expect(title).toHaveText(heading!);
        await expect(page.locator('[data-content-progress][data-active="true"]')).toHaveCount(1);
        expect(await slot.boundingBox()).toEqual(before);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        release(); await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.locator('.navigation-feedback[data-pending="true"]')).toHaveCount(0);
        if (area === "procurement") await expect(page.getByRole("heading", { name: translate("采购与到货历史", locale), exact: true })).toBeVisible();
      } finally { release(); await page.unrouteAll({ behavior: "wait" }); }
    }
  }
});

test("routed retail editor cancels without persisting and restores after reload at four widths", async ({ page }) => {
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
  await page.goto("/app/retail/units/demo-unit-1");
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const toggle of await page.locator('[data-retail-group] > button[aria-expanded="false"]').all()) if (await toggle.isVisible()) await toggle.click();
    await page.getByRole("button", { name: "编辑颜色", exact: true }).click();
    const editor = page.getByRole("region", { name: "编辑颜色", exact: true });
    await expect(editor).toBeVisible();
    const storageBefore = await page.evaluate(() => localStorage.getItem("chinatech.m1.retail.v1"));
    await editor.getByLabel("选择设备颜色", { exact: true }).click();
    await editor.getByRole("radio", { name: "其他颜色", exact: true }).locator("..").click();
    await editor.getByRole("textbox", { name: "其他颜色", exact: true }).fill("DEMO unsaved custom color");
    await editor.getByRole("button", { name: "取消", exact: true }).click();
    await expect(editor).toHaveCount(0); await page.reload();
    expect(await page.evaluate(() => localStorage.getItem("chinatech.m1.retail.v1"))).toBe(storageBefore);
    await expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

const repairFixture: IntakeReceiptData = { id: "LOCAL-F123456789ABCDEF", revision: 1, createdAt: "2026-10-16 09:00:00", updatedAt: "2026-10-16 09:00:00", previewAt: "2026-10-16 09:00:00", customerName: "DEMO recheck owner", phone: "+393200009163", email: "", category: "手机", brand: "Apple", model: "DEMO recheck phone", color: "", serial: "", faults: ["屏幕：碎裂"], issueNote: "", issue: "屏幕：碎裂", accessories: [], services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0, photos: [], custody: "store", itemQuotes: [{ item: "屏幕", amountCents: 0 }] };
async function seedRoutedRecheck(page: Page) {
  expect((await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } })).status()).toBe(200);
  await page.addInitScript(initial => {
    if (localStorage.getItem("site-ui-recheck-seeded")) return;
    localStorage.setItem("site-ui-recheck-seeded", "1");
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: [initial], signatures: [] }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: [{ id: "PO-DEMO-RECHECK", repairId: initial.id, item: "屏幕", supplier: "DEMO supplier", quantity: 2, unitCostCents: null, expectedAt: "", reference: "", events: [{ id: "DEMO-ordered", type: "ordered", quantity: 0, time: "2026-10-16 09:00:00", note: "DEMO immutable order" }] }], repairUpdates: {} }));
  }, repairFixture);
}

test("routed repair groups, nested mobile overview and stage cancel preserve zero quote and original revision", async ({ page }) => {
  await seedRoutedRecheck(page);
  await page.goto(`/app/repairs/${repairFixture.id}`);
  for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole("heading", { name: "工单详情", exact: true })).toHaveCount(1);
    const print = page.getByRole("button", { name: "打印接机单", exact: true });
    expect((await print.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const tabs = page.getByRole("tablist", { name: "工单详情分组", exact: true });
    for (const label of ["供应商", "照片", "历史", "维修"]) {
      await tabs.getByRole("tab", { name: new RegExp(`^${label}`) }).click();
      await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    }
    await expect(page.getByLabel("维修报价", { exact: true })).toContainText("0.00");
    if (width < 768) {
      const summary = page.locator("summary").filter({ hasText: "工单概况与客户资料" });
      await summary.click(); await expect(summary.locator("..")).toHaveAttribute("open", "");
    }
    await page.getByRole("button", { name: `${repairFixture.id} 更改维修阶段`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "更改维修阶段", exact: true });
    await dialog.getByRole("button", { name: "关闭维修阶段", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.local-intakes.v1")!).records[0].revision)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
  }
});

test("routed customer save and cancel survive reload with original repair back-link", async ({ page }) => {
  await seedRoutedRecheck(page); await page.goto(`/app/customers/${customerId(repairFixture.phone)}`);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "编辑客户资料", exact: true }).click();
    await page.getByRole("textbox", { name: "客户备注（选填）", exact: true }).fill(`DEMO saved profile ${width}`);
    await page.getByRole("button", { name: "保存客户资料", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "客户备注（选填）", exact: true })).toHaveCount(0);
    await page.reload(); await expect(page.getByText(`DEMO saved profile ${width}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "编辑客户资料", exact: true }).click();
    await page.getByRole("textbox", { name: "客户称呼（选填）", exact: true }).fill("DEMO cancelled name");
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await page.reload(); await expect(page.getByRole("heading", { name: repairFixture.customerName, exact: true })).toBeVisible();
    const original = page.locator(`main a[href="/app/repairs/${repairFixture.id}"]`);
    await expect(original).toBeVisible(); await expect(original.locator(":scope > .navigation-feedback")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("routed procurement append and correction retain original batch after reload", async ({ page }) => {
  await seedRoutedRecheck(page); await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/app/procurement/PO-DEMO-RECHECK");
  await page.getByRole("spinbutton", { name: "本次到货数量", exact: true }).fill("1");
  await page.getByRole("button", { name: "追加本次到货", exact: true }).click();
  await expect(page.getByTestId("arrival-summary")).toHaveText("1 / 1 件");
  await page.reload();
  await page.getByRole("button", { name: "更正历史", exact: true }).click();
  const batch = await page.getByRole("combobox", { name: "原到货批次", exact: true }).inputValue();
  await page.getByRole("spinbutton", { name: "调整数量", exact: true }).fill("-1");
  await page.getByRole("textbox", { name: "更正原因", exact: true }).fill("DEMO correction preserves original batch");
  await page.getByRole("button", { name: "追加更正记录", exact: true }).click();
  await expect(page.getByTestId("arrival-summary")).toHaveText("0 / 2 件"); await page.reload();
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.procurement.v1")!).records[0].events);
  expect(events.map((event: { type: string }) => event.type)).toEqual(["ordered", "arrival", "correction"]);
  expect(events[2].arrivalId).toBe(batch);
  await expect(page.getByText("DEMO correction preserves original batch", { exact: true })).toBeVisible();
});
