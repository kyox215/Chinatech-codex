import { test, expect, type Page } from "@playwright/test";
import { emptyIntakeServices } from "../../lib/intake-services";
import { arrivedQuantity, type ProcurementRecord } from "../../lib/procurement";
import { defaultStoreSettings } from "../../lib/store-settings";
import { retailUnits } from "../../lib/retail-fixtures";
import { applyRetailCommand, retailWarrantyTermsVersion, type RetailUnit } from "../../lib/retail";
import { intakeRecordTime } from "../../lib/repair-intake-record";
import { customerSaleHref } from "../../lib/customers";

const repairId = "LOCAL-D000000000000001";
const recordId = "PO-LOCAL-FEEDBACK-ONE";
const procurementKey = "chinatech.m1.procurement.v1";
const retailKey = "chinatech.m1.retail.v1";
const time = "2026-10-01 09:00:00";
const intake = {
  id: repairId, revision: 1, createdAt: time, updatedAt: time, previewAt: time,
  customerName: "DEMO 状态测试", phone: "+393200008801", email: "",
  category: "手机", brand: "Apple", model: "DEMO Feedback", color: "", serial: "",
  faults: ["屏幕：碎裂"], issueNote: "", issue: "屏幕：碎裂", accessories: [],
  services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0, custody: "customer",
};
const records: ProcurementRecord[] = [
  { id: recordId, repairId, item: "屏幕", supplier: "MobileParts SRL", supplierId: "demo-mobile", quantity: 5, unitCostCents: 1000, expectedAt: "", reference: "", events: [{ id: "DEMO-ORDER-ONE", type: "ordered", quantity: 0, time, note: "DEMO 实际下单" }] },
  { id: "PO-LOCAL-FEEDBACK-TWO", repairId, item: "电池", supplier: "TechSupply Italia", supplierId: "demo-tech", quantity: 2, unitCostCents: 500, expectedAt: "", reference: "", events: [{ id: "DEMO-ORDER-TWO", type: "ordered", quantity: 0, time, note: "DEMO 实际下单" }] },
];

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.addInitScript(data => {
    // All records and storage failures here are synthetic local preview data.
    if (localStorage.getItem("business-feedback-seeded")) return;
    localStorage.setItem("business-feedback-seeded", "1");
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: [data.intake], signatures: [] }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: data.records, repairUpdates: {} }));
    localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: {} }));
    localStorage.setItem("chinatech.m1.store-settings.v1", JSON.stringify({ version: 1, settings: data.settings }));
    const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 2;
    canvas.getContext("2d")!.fillRect(0, 0, 2, 2);
    data.unit.photos = [canvas.toDataURL("image/jpeg")];
    localStorage.setItem("chinatech.m1.retail.v1", JSON.stringify({ version: 1, units: [data.unit] }));
  }, { intake, records, settings: defaultStoreSettings, unit: structuredClone(retailUnits[0]) });
});

async function savedRecord(page: Page): Promise<ProcurementRecord> {
  return page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).records.find((row: ProcurementRecord) => row.id === id), { key: procurementKey, id: recordId });
}
async function savedUnit(page: Page): Promise<RetailUnit> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).units[0], retailKey);
}
async function failStorage(page: Page, key: string) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as typeof window & { restoreFeedbackStorage?: () => void }).restoreFeedbackStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("DEMO feedback capacity failure", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, key);
}
async function restoreStorage(page: Page) {
  await page.evaluate(() => (window as typeof window & { restoreFeedbackStorage?: () => void }).restoreFeedbackStorage?.());
}
async function openRetailGroup(page: Page, id: string) {
  await expect(page.locator(`[data-retail-group="${id}"]`)).toBeVisible();
  const toggle = page.locator(`[data-retail-group="${id}"] > button[aria-controls]`);
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}

test("arrival and correction clear only successful facts, empty repeat does not append, reload restores history", async ({ page }) => {
  await page.goto(`/app/procurement/${recordId}`);
  const quantity = page.getByLabel("本次到货数量", { exact: true });
  const note = page.getByLabel("到货备注", { exact: true });
  await quantity.fill("1"); await note.fill("DEMO 本批一件");
  await page.getByRole("button", { name: "追加本次到货", exact: true }).click();
  await expect(quantity).toHaveValue(""); await expect(note).toHaveValue("");
  await expect(quantity).toBeFocused(); expect(arrivedQuantity(await savedRecord(page))).toBe(1);
  await page.getByRole("button", { name: "追加本次到货", exact: true }).click();
  expect((await savedRecord(page)).events).toHaveLength(2);
  await page.getByRole("button", { name: "更正历史", exact: true }).click();
  const correction = page.getByLabel("调整数量", { exact: true });
  const reason = page.getByLabel("更正原因", { exact: true });
  await correction.fill("-1"); await reason.fill("DEMO 误记更正");
  await page.getByRole("button", { name: "追加更正记录", exact: true }).click();
  await expect(correction).toHaveValue(""); await expect(reason).toHaveValue("");
  await expect(correction).toBeFocused(); expect((await savedRecord(page)).events).toHaveLength(3);
  await page.reload(); await expect(page.getByTestId("arrival-summary")).toHaveText("0 / 5 件");
});

test("failed arrival in parts dialog preserves facts, retry clears them and returns focus", async ({ page }) => {
  await page.goto("/app/repairs");
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO Feedback");
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible();
  for (const id of await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(rows => rows.map(row => row.id))) await page.locator(`#${id}`).click();
  let trigger = page.getByRole("button", { name: `${repairId} 供应商与配件操作`, exact: true });
  if (!await trigger.isVisible()) trigger = page.getByRole("button", { name: `${repairId} 配件操作`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "供应商与配件", exact: true });
  await dialog.locator(".repair-existing-parts > summary").click();
  const quantity = dialog.getByLabel("本次到货数量", { exact: true });
  const note = dialog.getByLabel("到货备注", { exact: true });
  await quantity.fill("1"); await note.fill("DEMO 保存失败仍保留"); await failStorage(page, procurementKey);
  await dialog.getByRole("button", { name: "追加本次到货", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "DEMO feedback capacity failure" })).toBeVisible();
  await expect(quantity).toHaveValue("1"); await expect(note).toHaveValue("DEMO 保存失败仍保留");
  expect(arrivedQuantity(await savedRecord(page))).toBe(0); expect((await savedRecord(page)).events).toHaveLength(1);
  await restoreStorage(page); await dialog.getByRole("button", { name: "追加本次到货", exact: true }).click();
  await expect(quantity).toHaveValue(""); await expect(note).toHaveValue("");
  await dialog.getByRole("button", { name: "关闭配件操作", exact: true }).click();
  await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await page.reload(); expect(arrivedQuantity(await savedRecord(page))).toBe(1); expect((await savedRecord(page)).events).toHaveLength(2);
});

test("photo review survives failed save, retry commits once and changed version blocks stale review", async ({ page }) => {
  await page.goto(`/app/retail/units/${retailUnits[0].id}`);
  await expect(page.getByRole("region", { name: "本台实物照片", exact: true })).toBeVisible();
  const tools = page.getByRole("button", { name: "照片 1", exact: true });
  if (await tools.isVisible()) await tools.click();
  await page.getByRole("button", { name: "移除当前实物照片", exact: true }).click();
  const save = page.getByRole("button", { name: "确认保存照片", exact: true });
  await failStorage(page, retailKey); await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "照片未保存" })).toBeVisible();
  await expect(save).toBeEnabled(); expect((await savedUnit(page)).photos).toHaveLength(1);
  await restoreStorage(page); await save.click(); await expect(save).toHaveCount(0);
  expect((await savedUnit(page)).photos).toHaveLength(0); await page.reload(); await expect(page.getByRole("region", { name: "本台实物照片", exact: true })).toBeVisible(); expect((await savedUnit(page)).photos).toHaveLength(0);
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!); const canvas = document.createElement("canvas"); canvas.width = 2; canvas.height = 2;
    data.units[0].photos = [canvas.toDataURL("image/jpeg")]; data.units[0].version++;
    localStorage.setItem(key, JSON.stringify(data)); window.dispatchEvent(new Event("chinatech-retail-change"));
  }, retailKey);
  const toggle = page.getByRole("button", { name: "照片 1", exact: true }); if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("button", { name: "移除当前实物照片", exact: true }).click();
  await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)!); data.units[0].version++; localStorage.setItem(key, JSON.stringify(data)); window.dispatchEvent(new Event("chinatech-retail-change")); }, retailKey);
  await expect(save).toBeDisabled(); await expect(page.getByRole("alert").filter({ hasText: "档案已变化" })).toBeVisible();
  expect((await savedUnit(page)).photos).toHaveLength(1);
});

test("failed aftersale link keeps one repair and retry closes the reverse association after refresh", async ({ page }) => {
  await page.goto("/app/dashboard");
  let unit = await savedUnit(page); let index = 0; const day = intakeRecordTime().slice(0, 10);
  const apply = (command: Parameters<typeof applyRetailCommand>[1]) => { unit = applyRetailCommand(unit, command, { id: `DEMO-FEEDBACK-${++index}`, time: intakeRecordTime(), title: "DEMO", detail: "DEMO" }, unit.version); };
  apply({ type: "sell", saleId: "DEMO-FEEDBACK-SALE", customerPhone: intake.phone, customerName: "DEMO 买家", priceCents: 10000, paymentUnreceived: true, warranty: { months: unit.warrantyMonths, termsVersion: retailWarrantyTermsVersion, shopName: defaultStoreSettings.shopName, address: defaultStoreSettings.address, phone: defaultStoreSettings.phone } });
  apply({ type: "payment", saleId: "DEMO-FEEDBACK-SALE", entryId: "DEMO-FEEDBACK-PAYMENT", amountCents: 10000, date: day, method: "cash", note: "DEMO" });
  apply({ type: "deliver", saleId: "DEMO-FEEDBACK-SALE", deliveryDate: day });
  apply({ type: "after_sale", saleId: "DEMO-FEEDBACK-SALE", caseId: "DEMO-FEEDBACK-CASE", date: day, issue: "DEMO售后", custody: "left" });
  await page.evaluate(({ key, unit }) => localStorage.setItem(key, JSON.stringify({ version: 1, units: [unit] })), { key: retailKey, unit });
  await page.goto(`/app/retail/units/${unit.id}`); await openRetailGroup(page, "sales");
  const link = page.getByRole("button", { name: "建立售后工单", exact: true });
  await failStorage(page, retailKey); await link.click(); await expect(page.getByRole("alert").filter({ hasText: "工单已保留" })).toBeVisible();
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.local-intakes.v1")!).records.filter((row: { retailOrigin?: { caseId: string } }) => row.retailOrigin?.caseId === "DEMO-FEEDBACK-CASE"));
  expect(created).toHaveLength(1); await restoreStorage(page); await link.click();
  await expect(page.getByRole("link", { name: "查看售后工单", exact: true })).toHaveAttribute("href", `/app/repairs/${created[0].id}`);
  await page.reload(); await openRetailGroup(page, "sales");
  const source = page.getByRole("link", { name: "查看售后工单", exact: true }); await source.click(); await expect(page).toHaveURL(new RegExp(created[0].id));
  const reverse = page.getByRole("link", { name: "整机售后 · 返回原销售档案", exact: true });
  await expect(reverse).toHaveAttribute("href", customerSaleHref({ unitId: unit.id, id: "DEMO-FEEDBACK-SALE" }));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.local-intakes.v1")!).records.filter((row: { retailOrigin?: { caseId: string } }) => row.retailOrigin?.caseId === "DEMO-FEEDBACK-CASE").length)).toBe(1);
});
