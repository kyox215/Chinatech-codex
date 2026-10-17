import { test, expect, type Page } from "@playwright/test";
import{readFileSync}from"node:fs";
import { retailUnits } from "../../lib/retail-fixtures";
import { emptyIntakeServices } from "../../lib/intake-services";
import {intakeDirectoryEntry} from "../../lib/repair-intake-record";
import {repairOrders} from "../../lib/repair-fixtures";
import {buildCustomerDevices} from "../../lib/customer-devices";
import type { IntakeReceiptData } from "../../lib/repair-intake-record";
import type { CatalogRow } from "../../lib/device-catalog";
import type { RetailHistoryRecord } from "../../lib/retail-history";
import { translate } from "../../lib/i18n/translate";
import { customerId } from "../../lib/customers";
import { mountInfiniteListFixture } from "./helpers/infinite-list-fixture";

type FixtureWindow = Window & { infiniteFixture: { mount: (kind: string, locale?: string) => void; unmount: () => void; setIdentity: () => void; failOffset: number | null; failStatus: number; holdOffset: number | null; calls: { offset: number; selected: string }[]; releases: (() => void)[] }; infiniteObservers: () => number };
async function login(page: Page) {
  if(process.env.CT_PERF_FIXTURE){const fixture=JSON.parse(readFileSync(process.env.CT_PERF_FIXTURE,'utf8')),base=String(test.info().project.use.baseURL);expect(base).toMatch(/^https?:\/\/localhost:318[79]$/);expect(fixture.email).toMatch(/@example\.test$/);const response=await page.request.post(base+'/api/auth/login',{headers:{Origin:base},data:{email:fixture.email,password:fixture.password,remember:false}});expect(response.status()).toBe(200);await page.context().addCookies([{name:'ct_store',value:fixture.storeId,url:base}]);return;}
  await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
}
const catalogRows: CatalogRow[] = Array.from({ length: 175 }, (_, i) => ({ id: `demo-scroll-${i}`, category: "phone", brand: "DEMO", family: "DEMO series", name: `DEMO Model ${i}`, releasedAt: null, year: null, generation: "", network: "unknown", platform: "", modelCodes: [`DEMO-${i}`], aliases: [], markets: [], status: "review", enabled: true, sourceUrls: [], checkedAt: null, notes: "", version: 1 }));
const history: RetailHistoryRecord[] = Array.from({ length: 175 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, source: "seatable", sourceSnapshot: "a".repeat(64), sourceRow: i + 2, sourceStatus: "以售", condition: "翻新机", customerName: "DEMO scroll customer", customerPhone: "+393200001234", category: "手机", brand: "DEMO", model: `Scroll phone ${i}`, color: null, memory: null, paymentMethod: null, askingPriceCents: null, salePriceCents: 100, depositCents: null, costCents: null, notes: null, batteryPercent: null, identifier: `DEMO-${i}`, intakeAt: "2026-10-17T10:00:00Z", pickupDate: "2026-10-17", sourceUpdatedAt: "2026-10-17T10:00:00Z", importedAt: "2026-10-17T10:00:00Z", reviewReasons: [] }));

async function catalogFixture(page: Page, respond?: (pageNumber: number, q: string) => Promise<{ status?: number; rows?: CatalogRow[] } | undefined>) {
  await page.route("**/api/catalog?kind=models*", async route => {
    const params = new URL(route.request().url()).searchParams, pageNumber = Number(params.get("page")), q = params.get("q") || "";
    const override = await respond?.(pageNumber, q);
    const all = catalogRows.filter(row => row.name.includes(q));
    await route.fulfill({ status: override?.status ?? 200, json: override?.status ? { message: "设备目录暂不可用，请稍后重试。" } : { rows: override?.rows ?? all.slice((pageNumber - 1) * 50, pageNumber * 50), total: all.length, page: pageNumber, pageSize: 50, revision: "seed" } }).catch(() => undefined);
  });
  await login(page); await page.goto("/app/catalog");
}

test("catalog appends API pages, retains rows on failure, retries and searches the final result", async ({ page }) => {
  let fail = true;
  await catalogFixture(page, async pageNumber => { if (pageNumber === 2 && fail) { fail = false; return { status: 503 }; } });
  const rows = page.getByRole("region", { name: "品牌型号目录表格" }).locator("tbody tr");
  const footer = page.getByRole("region", { name: "设备目录加载" });
  await expect(rows).toHaveCount(50);
  await footer.scrollIntoViewIfNeeded();
  await expect(page.getByRole("alert").filter({ hasText: "设备目录暂不可用" })).toContainText("设备目录暂不可用");
  await expect(rows).toHaveCount(50);
  await footer.getByRole("button", { name: "重试加载", exact: true }).click();
  await expect(rows).toHaveCount(100);
  await expect(rows.first()).toContainText("DEMO Model 0");
  await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(150);
  await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(175);
  await expect(footer).toContainText("已全部显示");
  await page.getByRole("textbox", { name: "搜索型号或机型码", exact: true }).fill("DEMO Model 174");
  await expect(rows).toHaveCount(1); await expect(rows).toContainText("DEMO Model 174");
  await page.getByRole("button", { name: "清空型号搜索", exact: true }).click();
  await expect(rows).toHaveCount(50);
});

test("catalog discards a delayed old-filter page and clears accumulated rows after access rejection", async ({ page }) => {
  let release!: () => void, retryRelease!: () => void, held = false, deny = false, deniedCalls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const retryGate = new Promise<void>(resolve => { retryRelease = resolve; });
  await catalogFixture(page, async pageNumber => { if (pageNumber === 2) { held = true; if (!deny) await gate; if (deny && ++deniedCalls === 1) return { status: 403 }; if (deny && deniedCalls === 2) { await retryGate; return { status: 503 }; } } });
  const rows = page.getByRole("region", { name: "品牌型号目录表格" }).locator("tbody tr");
  const footer = page.getByRole("region", { name: "设备目录加载" });
  await expect(rows).toHaveCount(50); await footer.scrollIntoViewIfNeeded(); await expect.poll(() => held).toBe(true);
  await page.getByRole("textbox", { name: "搜索型号或机型码", exact: true }).fill("DEMO Model 174");
  await expect(rows).toHaveCount(1); release(); await expect(rows).toHaveCount(1);
  deny = true;
  await page.getByRole("button", { name: "清空型号搜索", exact: true }).click(); await expect(rows).toHaveCount(50);
  await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(0);
  await page.getByRole("button", { name: "重新查询目录", exact: true }).click();
  await expect.poll(() => deniedCalls).toBe(2); await expect(rows).toHaveCount(0);
  retryRelease(); await expect(page.getByRole("button", { name: "重新查询目录", exact: true })).toBeEnabled(); await expect(rows).toHaveCount(0);
  await page.getByRole("button", { name: "重新查询目录", exact: true }).click(); await expect(rows).toHaveCount(50);
});

test("customer devices append complete physical identities and reset after search", async ({ page }) => {
  const records: IntakeReceiptData[] = Array.from({ length: 90 }, (_, i) => ({ id: `LOCAL-E${i.toString(16).toUpperCase().padStart(15, "0")}`, revision: 1, createdAt: "2026-10-17 09:00:00", updatedAt: "2026-10-17 09:00:00", previewAt: "2026-10-17 09:00:00", customerName: "DEMO scroll", phone: "+393200001234", email: "", category: "手机", brand: "DEMO", model: `Scroll device ${i}`, color: "", serial: `DEMO-SERIAL-${i}`, faults: ["屏幕：碎裂"], issueNote: "", issue: "屏幕：碎裂", accessories: [], services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0, custody: "customer", itemQuotes: [{ item: "屏幕", amountCents: 100 }] }));
  const sold = retailUnits.find(unit => unit.sales.length)!;
  const units = Array.from({ length: 90 }, (_, i) => ({ ...sold, id: `DEMO-SCROLL-UNIT-${i}`, code: `DEMO-SCROLL-${i}`, serial: `DEMO-SALE-SERIAL-${i}`, imei1: "", imei2: "", sales: sold.sales.map(sale => ({ ...sale, id: `DEMO-SCROLL-SALE-${i}`, customerPhone: "+393200001234" })) }));
  await page.addInitScript(({ records, units }) => { localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records })); localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units })); }, { records, units });
  await login(page); await page.goto("/app/customer-devices");
  const rows = page.locator(".customer-device-card"), cache = page.locator('.customer-device-window'), footer = page.getByRole("region", { name: "客户设备", exact: true });
  const expectedTotal=buildCustomerDevices([...repairOrders,...records.map(intakeDirectoryEntry)],units).length;expect(expectedTotal).toBeLessThanOrEqual(200);
  // This complete canonical fixture is below the 200-device window threshold.
  // Verify both retained summaries and actual cards, rather than an obsolete
  // generic footer name or an assumption about larger windowed datasets.
  async function expectDevices(count:number){await expect(cache).toHaveAttribute('data-device-cache',String(count));await expect(rows).toHaveCount(count);expect(new Set(await rows.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-device-id')))).size).toBe(count);await expect(footer).toContainText(new RegExp(`\\b${count}\\s*/\\s*${expectedTotal}\\b`));}
  await expectDevices(50); await footer.scrollIntoViewIfNeeded(); await expectDevices(100);
  await footer.scrollIntoViewIfNeeded(); await expectDevices(150);
  await page.getByRole("searchbox", { name: "搜索客户设备", exact: true }).fill("DEMO-SERIAL-89"); await expect(rows).toHaveCount(1);
  await expect(cache).toHaveAttribute('data-device-cache','1');await expect(rows).toContainText('DEMO-SERIAL-89');
  await page.getByRole("button", { name: "清空搜索客户设备", exact: true }).click(); await expectDevices(50);
});

test("retail old page links cumulatively restore rows and customer history appends independently", async ({ page }) => {
  await page.addInitScript(records => { localStorage.setItem("chinatech.m1.retail-history.v1", JSON.stringify({ version: 1, records })); }, history);
  await login(page); await page.goto("/app/retail?view=sold&page=2");
  const rows = page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link");
  const footer = page.getByRole("region", { name: "整机商品加载" });
  await expect(rows).toHaveCount(100); await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(150);
  await expect(page).toHaveURL(/page=3/);
  await expect(rows.first()).toHaveAttribute("href", /page%3D3/);
  const first = rows.first(); await first.click(); await expect(page).toHaveURL(/\/app\/retail\/history\//);
  await page.goBack(); await expect(rows).toHaveCount(150);
  await page.getByRole("searchbox", { name: "搜索整机商品", exact: true }).fill("Scroll phone 174"); await expect(rows).toHaveCount(1);
  await page.getByRole("button", { name: "清空搜索整机商品", exact: true }).click(); await expect(rows).toHaveCount(50);
  await page.goto(`/app/customers/${customerId("+393200001234")}?records=history`);
  const historyRows = page.getByRole("region", { name: "客户历史记录", exact: true }).locator("ol > li");
  const historyFooter = page.getByRole("region", { name: "客户历史整机加载" });
  await expect(historyRows).toHaveCount(50); await historyFooter.scrollIntoViewIfNeeded(); await expect(historyRows).toHaveCount(100);
});

test("two real footers do not drain while stationary, remain independent and disconnect on unmount", async ({ page }) => {
  const errors = await mountInfiniteListFixture(page);
  await page.evaluate(() => (window as unknown as FixtureWindow).infiniteFixture.mount("short"));
  const a = page.locator('[data-rows="DEMO A"] > div'), b = page.locator('[data-rows="DEMO B"] > div');
  await expect(a).toHaveCount(100); await expect(b).toHaveCount(100);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(a).toHaveCount(100); await expect(b).toHaveCount(100);
  await page.getByRole("region", { name: "DEMO A footer" }).getByRole("button", { name: "加载更多" }).click();
  await expect(a).toHaveCount(150); await expect(b).toHaveCount(100);
  await page.evaluate(() => (window as unknown as FixtureWindow).infiniteFixture.mount("lists"));
  await expect(a).toHaveCount(50); await expect(b).toHaveCount(50);
  await page.getByRole("region", { name: "DEMO A footer" }).scrollIntoViewIfNeeded(); await expect(a).toHaveCount(100);
  await page.evaluate(() => { scrollTo(0, 0); (window as unknown as FixtureWindow).infiniteFixture.setIdentity(); });
  await expect(a).toHaveCount(50); await expect(b).toHaveCount(50);
  await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).infiniteObservers())).toBe(2);
  await page.evaluate(() => (window as unknown as FixtureWindow).infiniteFixture.unmount());
  await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).infiniteObservers())).toBe(0);
  expect(errors).toEqual([]);
});

test("session API keeps 20-row batches, preserves failed pages, isolates staff and rejects late identity results", async ({ page }) => {
  const errors = await mountInfiniteListFixture(page);
  await page.evaluate(() => { const api = (window as unknown as FixtureWindow).infiniteFixture; api.failOffset = 20; api.mount("staff"); });
  const rows = page.locator("[data-session-id]"), footer = page.getByRole("region", { name: "登录设备加载" });
  await expect(rows).toHaveCount(20); await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(20);
  await expect(footer.getByRole("button", { name: "重试加载" })).toBeEnabled();
  await footer.getByRole("button", { name: "重试加载" }).click(); await expect(rows).toHaveCount(40);
  await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(60);
  await page.locator("select").selectOption("DEMO-STAFF", { force: true }); await expect(rows).toHaveCount(20);
  await expect(rows.first()).toHaveAttribute("data-session-id", "DEMO-STAFF-0");
  await page.evaluate(() => { (window as unknown as FixtureWindow).infiniteFixture.holdOffset = 20; });
  await footer.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as unknown as FixtureWindow).infiniteFixture.releases.length)).toBeGreaterThan(0);
  await page.evaluate(() => { const api = (window as unknown as FixtureWindow).infiniteFixture; api.setIdentity(); api.holdOffset = null; api.releases.forEach(release => release()); });
  await expect(rows).toHaveCount(20);
  await expect(footer).toContainText("已显示 20 条");
  expect(errors).toEqual([]);
});


test("built footer CSS keeps three languages and 44px controls at four widths", async ({ page }) => {
  const errors = await mountInfiniteListFixture(page, true);
  for (const locale of ["zh-CN", "it", "en"] as const) for (const width of [1440, 1024, 390, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(locale => { scrollTo(0, 0); (window as unknown as FixtureWindow).infiniteFixture.mount("lists", locale); }, locale);
    const rows = page.locator('[data-rows="DEMO A"] > div'), footer = page.getByRole("region", { name: "DEMO A footer" });
    await expect(rows).toHaveCount(50);
    await footer.scrollIntoViewIfNeeded(); await expect(rows).toHaveCount(100);
    await expect(footer).toContainText(translate("已显示 {v0} / {v1} 条", locale, { v0: 100, v1: 175 }));
    const button = footer.getByRole("button", { name: translate("加载更多", locale), exact: true });
    await expect(button).not.toHaveAttribute("aria-busy", "true");
    const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
