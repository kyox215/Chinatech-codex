import { test, expect, type Page } from "@playwright/test";
import { currentRetailSale, type RetailUnit } from "../../lib/retail";
import { previewRetailHistoryKey } from "../../lib/retail-record";
import type { RetailHistoryRecord } from "../../lib/retail-history";
import { customerId } from "../../lib/customers";

const source: RetailHistoryRecord = { id: "00000000-0000-5000-8000-000000000051", source: "seatable", sourceSnapshot: "a".repeat(64), sourceRow: 52, sourceStatus: "在售", condition: "翻新机", customerName: "DEMO 原候选买家", customerPhone: "+393200009800", category: "手机", brand: "Apple", model: "DEMO 在售样机", color: "NERO", memory: "128GB", paymentMethod: null, askingPriceCents: 22000, salePriceCents: null, depositCents: null, costCents: 12000, notes: "DEMO 原资料内部备注", batteryPercent: 78, identifier: "000000000000051", intakeAt: "2026-09-02T09:00:00Z", pickupDate: null, sourceUpdatedAt: "2026-09-03T10:00:00Z", importedAt: "2026-10-02T10:00:00Z", reviewReasons: ["DEMO 身份待实物核对"] };
const oldSale: RetailHistoryRecord = { ...source, id: "00000000-0000-5000-8000-000000000052", sourceRow: 53, sourceStatus: "以售", model: "DEMO 原已售商品", identifier: "ORIGINAL-OLD-SN", customerName: "DEMO 原买家", customerPhone: "+393200009899", salePriceCents: 23000, depositCents: 5000, pickupDate: "2026-09-30", reviewReasons: [] };
test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ key, records }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, records })); if (!localStorage.getItem("chinatech.m1.retail.v1")) localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units: [] })); }, { key: previewRetailHistoryKey, records: [source, oldSale] });
  await page.goto("/login"); await page.getByRole("button", { name: "填入演示账号", exact: true }).click(); await page.getByRole("button", { name: "登录工作台", exact: true }).click(); await expect(page).toHaveURL(/\/app\/dashboard$/);
});
async function openGroup(page: Page, id: string) { const group = page.locator(`[data-retail-group="${id}"]`); await expect(group).toBeVisible(); const toggle = group.locator(":scope > button"); if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click(); const sourceDetails = group.locator("details"); if (id === "source" && await sourceDetails.getAttribute("open") === null && await sourceDetails.locator(":scope > summary").isVisible()) await sourceDetails.locator(":scope > summary").click(); await expect(group.locator(":scope > div[id]")).toBeVisible(); }
async function savedUnit(page: Page): Promise<RetailUnit> { return page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units[0]); }

test("在售商品直接打开图形详情，旧链接同页，阅读和取消不登记，四宽度保留原资料", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await expect(page.locator(".retail-metrics").getByRole("link", { name: "1 在售商品", exact: true })).toHaveAttribute("href", "/app/retail");
  await page.goto("/app/retail"); await expect(page.getByRole("link", { name: "单机管理", exact: true })).toHaveCount(0);
  const table = page.getByRole("region", { name: "整机商品表格", exact: true }); await expect(table.getByRole("link")).toHaveCount(1); await table.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/app/retail/units/${source.id}`)); await expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "单机摘要", exact: true })).toContainText("€220.00");
  await expect(page.getByRole("region", { name: "单机摘要", exact: true })).toContainText("128GB");
  await expect(page.getByRole("button", { name: "登记售出", exact: true })).toHaveCount(0);
  const before = await page.evaluate(key => localStorage.getItem(key), previewRetailHistoryKey);
  for (const width of [1440, 1024, 390, 375]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `.local/ui-proof/retail-unified/${info.project.name}-source-${width}.png`, fullPage: true }); }
  await openGroup(page, "source"); await expect(page.getByRole("region", { name: "原商品资料", exact: true })).toContainText(source.identifier!);
  await openGroup(page, "actions"); await page.getByRole("textbox", { name: "型号 / 商品名称", exact: true }).fill("DEMO 未提交草稿");
  await page.getByRole("link", { name: "返回商品列表", exact: true }).click(); await expect(table.getByRole("link")).toHaveCount(1);
  expect(await page.evaluate(key => localStorage.getItem(key), previewRetailHistoryKey)).toBe(before); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units)).toEqual([]);
  await page.goto(`/app/retail/history/${source.id}`); await expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible(); await expect(page.getByRole("region", { name: "单机摘要", exact: true })).toContainText(source.model!); expect(errors).toEqual([]);
});

test("原在售商品同页核对→明确可售→新买家→实际收款交付→打印与客户回链，列表不重复", async ({ page }) => {
  test.setTimeout(120000); await page.goto("/app/retail"); await page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link").click(); await openGroup(page, "actions");
  const form = page.getByRole("form", { name: "核对商品资料", exact: true });
  await form.getByRole("combobox", { name: "识别码类型", exact: true }).selectOption("imei");
  await form.getByRole("checkbox", { name: "确认这是门店自有且当前在店的实物", exact: true }).check();
  for (const name of ["功能检测已完成", "所有权及账号锁已核验", "数据处理已核验"]) await form.getByRole("checkbox", { name, exact: true }).check();
  await form.getByRole("button", { name: "继续核对", exact: true }).click(); await form.getByRole("button", { name: "确认保存商品资料", exact: true }).click();
  await expect(page.locator(".module-heading")).toContainText("待检测"); expect((await savedUnit(page)).status).toBe("inspecting"); expect((await savedUnit(page)).sales).toHaveLength(0); await expect(page.locator('[aria-label="关键概览"]')).toContainText("128GB"); await expect(page.locator('[aria-label="关键概览"]')).toContainText("容量原文");
  await page.getByRole("textbox", { name: "检测说明 / 变更原因", exact: true }).fill("DEMO 明确核对可售"); await page.getByRole("button", { name: "设为可售", exact: true }).click(); await page.getByRole("button", { name: "确认操作", exact: true }).click(); await expect(page.locator(".module-heading")).toContainText("可售");
  await page.getByRole("button", { name: "登记售出", exact: true }).click(); const saleForm = page.getByRole("region", { name: /登记售出/ });
  const phone = "+393200009801"; await saleForm.getByRole("combobox", { name: "客户手机号 *", exact: true }).fill(phone); await saleForm.getByLabel("客户称呼（选填）", { exact: true }).fill("DEMO 新买家"); await saleForm.getByLabel("本台成交价", { exact: true }).fill("220"); await saleForm.getByRole("checkbox", { name: /确认本次尚未收款/ }).check(); await saleForm.getByRole("button", { name: "继续核对售出", exact: true }).click();
  await saleForm.getByRole("checkbox", { name: "已与客户核对商品、成交价及保修条款", exact: true }).check(); await saleForm.getByRole("button", { name: "确认登记售出", exact: true }).click();
  let unit = await savedUnit(page); const sale = currentRetailSale(unit)!; const card = page.locator(`[id="sale-${sale.id}"]`); await expect(card).toBeVisible();
  expect(unit.id).toBe(source.id); expect(unit.code).toBe("ST-0051"); expect(unit.imei1).toBe(source.identifier); expect(unit.bodyStorage).toBeNull(); expect(sale.customerPhone).toBe(phone); expect(sale.paidCents).toBe(0);
  await card.getByRole("button", { name: "登记收款", exact: true }).click(); const payment = card.getByRole("region", { name: "登记收款", exact: true }); await payment.getByLabel("本次实际收款", { exact: true }).fill("220"); await payment.getByRole("radio", { name: "现金", exact: true }).locator("..").click(); await payment.getByLabel("收款备注与核对依据", { exact: true }).fill("DEMO 实际现金收款"); await payment.getByRole("button", { name: "继续核对", exact: true }).click(); await card.getByRole("button", { name: "确认保存业务记录", exact: true }).click();
  await card.getByRole("button", { name: "确认交付", exact: true }).click(); await card.getByRole("button", { name: "继续核对", exact: true }).click(); await card.getByRole("button", { name: "确认保存业务记录", exact: true }).click(); await expect(card).toContainText("销售已结清并交付");
  await card.getByRole("button", { name: "打印销售与保修单", exact: true }).click(); const print = page.locator(".intake-receipt-dialog"); await print.locator(".intake-receipt-options select").nth(1).selectOption("zh"); await expect(print).toContainText("DEMO 新买家"); await expect(print).toContainText("ST-0051"); await expect(print).not.toContainText(source.notes!); await expect(print).not.toContainText("€120.00"); await print.locator(".intake-receipt-toolbar button.icon-button").click();
  unit = await savedUnit(page); expect(currentRetailSale(unit)!.delivered).toBe(true); expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).records[0], previewRetailHistoryKey)).toEqual(source);
  await page.goto("/app/retail?view=sold"); await expect(page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link")).toHaveCount(2);
  await page.goto("/app/retail"); await expect(page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link")).toHaveCount(0);
  await page.goto(`/app/customers/${customerId(phone)}?records=sales`); await page.getByRole("link").filter({ hasText: "DEMO 在售样机" }).click(); await expect(page).toHaveURL(new RegExp(`sale=${sale.id}`)); await expect(card).toBeVisible(); await expect(card).toContainText("DEMO 新买家");
  await page.goto(`/app/customers/${customerId(source.customerPhone!)}?records=history`); await page.getByRole("link").filter({ hasText: "DEMO 在售样机" }).click(); await expect(page).toHaveURL(/original=1/); const original = page.getByRole("region", { name: "原商品资料", exact: true }); await expect(original.getByText(source.customerName!, { exact: true })).toBeVisible(); await expect(original).not.toContainText("DEMO 新买家");
});

test("旧已售和新商品共用详情，原成交定金和买家保留，不伪造已收或重新上架", async ({ page }) => {
  await page.goto("/app/retail?view=sold"); await page.getByRole("region", { name: "整机商品表格", exact: true }).getByRole("link").click(); await expect(page.getByRole("heading", { name: "商品档案", exact: true })).toBeVisible(); await openGroup(page, "actions");
  const original = page.getByRole("region", { name: "原销售记录", exact: true }); await expect(original).toContainText("DEMO 原买家"); await expect(original).toContainText("230,00"); await expect(original).toContainText("50,00"); await expect(original).toContainText("定金不代表全部实收。");
  await expect(page.getByRole("form", { name: "核对商品资料", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "登记售出", exact: true })).toHaveCount(0); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.retail.v1")!).units)).toEqual([]);
  await page.goto("/app/retail?source=units"); await expect(page.getByRole("link", { name: "单机管理", exact: true })).toHaveCount(0); await expect(page.getByRole("link", { name: "在售商品 1", exact: true })).toHaveAttribute("aria-current", "page");
});
