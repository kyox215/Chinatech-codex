import { test, expect, type Locator, type Page } from "@playwright/test";
import { retailUnits } from "../../lib/retail-fixtures";
import { parseStoredRetailUnits, type RetailUnit } from "../../lib/retail";
import { previewRetailHistoryKey } from "../../lib/retail-record";
import type { RetailHistoryRecord } from "../../lib/retail-history";
import { translate } from "../../lib/i18n/translate";
import type { Locale } from "../../lib/i18n/locale";

const original: RetailHistoryRecord = { id: "00000000-0000-5000-8000-000000000061", source: "seatable", sourceSnapshot: "b".repeat(64), sourceRow: 62, sourceStatus: "在售", condition: "翻新机", customerName: null, customerPhone: null, category: "手机", brand: "Apple", model: "DEMO iPhone 8", color: "BIANCO", memory: "64GB", paymentMethod: null, askingPriceCents: 8000, salePriceCents: null, depositCents: null, costCents: 2000, notes: null, batteryPercent: 100, identifier: "DEMO-ORIGINAL-0061", intakeAt: "2026-06-03T09:00:00Z", pickupDate: null, sourceUpdatedAt: "2026-09-03T10:00:00Z", importedAt: "2026-10-02T10:00:00Z", reviewReasons: [] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ original, key, units }) => { if (!localStorage.getItem("density-seeded")) { localStorage.setItem("density-seeded", "1"); localStorage.setItem(key, JSON.stringify({ version: 1, records: [original] })); localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units })); } }, { original, key: previewRetailHistoryKey, units: retailUnits });
  await page.goto("/login"); await page.getByRole("button", { name: "填入演示账号", exact: true }).click(); await page.getByRole("button", { name: "登录工作台", exact: true }).click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
});

async function activate(target: Locator) { if (test.info().project.use.hasTouch) await target.tap(); else await target.click(); }
async function language(page: Page, locale: Locale) {
  const select = page.getByLabel("语言 / Lingua / Language", { exact: true });
  if (!await select.isVisible()) {
    if (await page.evaluate(() => innerWidth < 768)) { const menu = page.locator(".page-menu-button"); if (await menu.getAttribute("aria-expanded") !== "true") await activate(menu); }
    const account = page.locator(".sidebar-account"); if (await account.getAttribute("open") === null) await activate(account.locator("summary"));
  }
  await select.selectOption(locale); await expect(page.locator("html")).toHaveAttribute("lang", locale);
  const close = page.locator(".app-sidebar__close");
  if (await close.isVisible()) { await activate(close); await expect.poll(() => page.locator("#app-sidebar").evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(1); }
  else { const account = page.locator(".sidebar-account[open] summary"); if (await account.isVisible()) await activate(account); }
}
async function openGroup(page: Page, id: string) {
  const group = page.locator(`[data-retail-group="${id}"]`); const toggle = group.locator(":scope > button");
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await activate(toggle);
  await expect(group.locator(":scope > div[id]")).toBeVisible();
}
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1)).toBe(true); }

test("日常商品资料与主要操作落在电脑首屏，手机保持单组展开及草稿", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const before = await page.evaluate(() => localStorage.getItem("chinatech.m1.retail.v1"));
  for (const id of [original.id, retailUnits[1].id]) {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`/app/retail/units/${id}`); await expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible(); await fits(page);
    expect((await page.getByRole("region", { name: "单机摘要", exact: true }).boundingBox())!.height).toBeLessThanOrEqual(190);
    for (const group of ["identity", "physical", "finance"]) { const box = (await page.locator(`[data-retail-group="${group}"]`).boundingBox())!; expect(box.y + box.height).toBeLessThanOrEqual(900); }
    const primary = page.getByRole("button", { name: id === original.id ? "继续核对" : "设为可售", exact: true }); const box = (await primary.boundingBox())!; expect(box.y + box.height).toBeLessThanOrEqual(900); expect(box.height).toBeGreaterThanOrEqual(44);
    if (id !== original.id) { const warranty = (await page.getByRole("region", { name: "商家保修", exact: true }).boundingBox())!; expect(warranty.y + warranty.height).toBeLessThanOrEqual(900); }
    await page.screenshot({ path: `.local/ui-proof/retail-density/${info.project.name}-${id === original.id ? "source" : "managed"}-1440.png`, fullPage: true, animations: "disabled" });
    await page.setViewportSize({ width: 1024, height: 768 }); await fits(page); expect((await page.getByRole("region", { name: "单机摘要", exact: true }).boundingBox())!.height).toBeLessThanOrEqual(245);
  }
  expect(await page.evaluate(() => localStorage.getItem("chinatech.m1.retail.v1"))).toBe(before);
  await page.setViewportSize({ width: 767, height: 900 }); await openGroup(page, "actions"); const note = page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true }); await note.fill("DEMO 跨断点保留草稿");
  await page.setViewportSize({ width: 768, height: 900 }); await expect(note).toHaveValue("DEMO 跨断点保留草稿"); await fits(page);
  await page.setViewportSize({ width: 375, height: 812 }); await openGroup(page, "identity"); await expect(note).not.toBeVisible(); await openGroup(page, "actions"); await expect(note).toHaveValue("DEMO 跨断点保留草稿"); await expect(page.locator('[data-retail-group][data-open="true"]')).toHaveCount(1); expect(await note.evaluate(e => getComputedStyle(e).fontSize)).toBe("16px"); await fits(page);
  expect(errors).toEqual([]);
});

test("三语长资料、百万金额和负毛利完整可读，零与未知保持不同", async ({ page }, info) => {
  test.setTimeout(120000);
  const phone: RetailUnit = { ...structuredClone(retailUnits[0]), model: "DEMO Long Device Name With Complete Model Edition And Cellular Variant", serial: "DEMO-SERIAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789", priceCents: 100000000, costCents: 100000000, refurbCents: 100000000, batteryPercent: 100, knownIssues: "DEMO 第一点完整说明\nDEMO Second complete issue description\nDEMO Terza descrizione completa", accessories: "DEMO charger, cable, original packaging and two adapters", warrantyMonths: 18 };
  const laptop: RetailUnit = { ...structuredClone(retailUnits[3]), model: "DEMO Long Computer Model With Complete Keyboard And Processor Edition", priceCents: 0, costCents: 0, refurbCents: null, serial: "DEMO-COMPUTER-SERIAL-ABCDEFGHIJKLMNOPQRSTUVWXYZ", disks: [{ type: "NVMe SSD", capacity: 512, unit: "GB" }, { type: "SSD", capacity: 256, unit: "GB" }, { type: "HDD", capacity: 1, unit: "TB" }] };
  const units = [phone, laptop]; parseStoredRetailUnits(JSON.stringify({ version: 1, units }), []);
  await page.evaluate(units => localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units })), units);
  for (const locale of ["zh-CN", "it", "en"] as const) {
    for (const unit of units) {
      await page.goto(`/app/retail/units/${unit.id}`); await language(page, locale);
      for (const width of [1440, 1024, 390, 375]) {
        await page.setViewportSize({ width, height: 950 }); await openGroup(page, "identity"); await expect(page.locator('[data-retail-group="identity"]')).toContainText(unit.serial); await fits(page);
        const brokenMetricWords = await page.locator(`[aria-label="${translate("关键概览", locale)}"] strong`).evaluateAll(elements => elements.flatMap(el => { const broken: string[] = []; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node: Node | null; while ((node = walker.nextNode())) { for (const match of (node.textContent || "").matchAll(/[A-Za-zÀ-ÿ]{3,}/gu)) { const range = document.createRange(); range.setStart(node, match.index!); range.setEnd(node, match.index! + match[0].length); if (new Set([...range.getClientRects()].map(r => Math.round(r.top))).size > 1) broken.push(match[0]); } } return broken; })); expect(brokenMetricWords, `${locale} ${unit.category} ${width}px`).toEqual([]);
        await openGroup(page, "physical"); const physical = page.locator('[data-retail-group="physical"]'); await expect(physical).toContainText(unit.knownIssues); if (unit.id === laptop.id) { for (const value of ["NVMe SSD", "512 GB", "256 GB", "1 TB"]) await expect(physical).toContainText(value); }
        await openGroup(page, "finance"); const finance = page.locator('[data-retail-group="finance"]');
        const values = await finance.locator("strong, button > span > span").evaluateAll(elements => elements.map(el => { const range = document.createRange(); range.selectNodeContents(el); const rects = [...range.getClientRects()]; const tile = el.closest("[data-retail-group]")!.getBoundingClientRect(); return { text: el.textContent || "", rows: new Set(rects.map(r => Math.round(r.top))).size, right: Math.max(...rects.map(r => r.right)), tileRight: tile.right }; }));
        for (const value of values.filter(value => value.text.includes("€"))) { expect(value.rows).toBe(1); expect(value.right).toBeLessThanOrEqual(value.tileRight + 1); }
        if (unit.id === laptop.id) { await expect(finance).toContainText(translate("待确认", locale)); await expect(finance).toContainText("€0"); }
        if (width === 1440 || width === 375) await page.screenshot({ path: `.local/ui-proof/retail-density/${info.project.name}-${locale}-${unit.category}-${width}.png`, fullPage: true, animations: "disabled" });
      }
    }
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units)).toEqual(units);
});

test("紧凑保修选择自定义时显示独立月数，核对保存与打印恢复焦点完整", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(`/app/retail/units/${retailUnits[1].id}`); await openGroup(page, "warranty");
  const warranty = page.getByRole("region", { name: "商家保修", exact: true }); await warranty.getByRole("combobox", { name: "商家保修期限", exact: true }).selectOption("custom");
  const custom = warranty.getByRole("textbox", { name: "自定义商家保修月数", exact: true }); await expect(custom).toBeVisible();
  const selectBox = (await warranty.getByRole("combobox", { name: "商家保修期限", exact: true }).boundingBox())!; const customBox = (await custom.boundingBox())!; expect(customBox.y).toBeGreaterThanOrEqual(selectBox.y + selectBox.height);
  await custom.fill("18"); await warranty.getByRole("button", { name: "核对修改", exact: true }).click(); await warranty.getByRole("button", { name: "确认保存", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units.find((u: RetailUnit) => u.id === "demo-unit-2").warrantyMonths)).toBe(18);
  await page.reload(); await openGroup(page, "warranty"); await expect(custom).toHaveValue("18");
  const print = warranty.getByRole("button", { name: "保修单预览", exact: true }); await print.click(); await expect(page.locator(".intake-receipt-dialog")).toBeVisible(); await page.locator(".intake-receipt-toolbar button.icon-button").click(); await expect(print).toBeFocused(); await fits(page);
});
