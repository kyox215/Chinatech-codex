import { test, expect, type Page } from "@playwright/test";
import { emptyIntakeServices } from "../../lib/intake-services";
import { defaultStoreSettings } from "../../lib/store-settings";

const repairId = "LOCAL-E000000000000001";
const workflowKey = "chinatech.m1.repair-workflow.v1";
const intakeKey = "chinatech.m1.local-intakes.v1";

async function openDialog(page: Page, faults: string[] = []) {
  const response = await page.request.post("/api/preview-session", { data: { email: "demo@chinatech.local", password: "Preview2026!" } });
  expect(response.status()).toBe(200);
  await page.addInitScript(({ repairId, faults, services, settings }) => {
    if (localStorage.getItem("procurement-owner-seeded")) return;
    localStorage.setItem("procurement-owner-seeded", "1");
    const intake = { id: repairId, revision: 1, createdAt: "2026-10-01 09:00:00", updatedAt: "2026-10-01 09:00:00", previewAt: "2026-10-01 09:00:00", customerName: "DEMO 请求归属", phone: "+393200009001", email: "", category: "手机", brand: "Apple", model: "DEMO Procurement Owner", color: "", serial: "", faults, issueNote: faults.length ? "" : "DEMO 人工核对", issue: faults.join("、") || "DEMO 人工核对", accessories: [], services, priority: "普通", photoCount: 0, custody: "customer" };
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: [intake], signatures: [] }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: [], repairUpdates: {} }));
    localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: {} }));
    localStorage.setItem("chinatech.m1.store-settings.v1", JSON.stringify({ version: 1, settings }));
  }, { repairId, faults, services: structuredClone(emptyIntakeServices), settings: defaultStoreSettings });
  await page.goto("/app/repairs");
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO Procurement Owner");
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible();
  for (const id of await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(rows => rows.map(row => row.id))) await page.locator(`#${id}`).click();
  let trigger = page.getByRole("button", { name: `${repairId} 供应商与配件操作`, exact: true });
  if (!await trigger.isVisible()) trigger = page.getByRole("button", { name: `${repairId} 配件操作`, exact: true });
  await trigger.click();
  return page.getByRole("dialog", { name: "供应商与配件", exact: true });
}

async function failWorkflow(page: Page) {
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as typeof window & { restoreOwnerStorage?: () => void }).restoreOwnerStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("DEMO synthetic storage failure", "QuotaExceededError"); return original.call(this, name, value); };
  }, workflowKey);
}

async function restoreWorkflow(page: Page) {
  await page.evaluate(() => (window as typeof window & { restoreOwnerStorage?: () => void }).restoreOwnerStorage?.());
}

test("failed project keeps its inputs and settled retry releases the modal after the child disappears", async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.getByLabel("维修项目", { exact: true }).fill("DEMO 手工检测");
  await dialog.getByLabel("具体要求（选填）", { exact: true }).fill("DEMO 保留项目草稿");
  await failWorkflow(page);
  await dialog.getByRole("button", { name: "添加维修项目", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "维修状态未改变" })).toBeVisible();
  await expect(dialog.getByLabel("维修项目", { exact: true })).toHaveValue("DEMO 手工检测");
  await expect(dialog.getByRole("button", { name: "关闭配件操作", exact: true })).toBeEnabled();
  await restoreWorkflow(page);
  await dialog.getByRole("button", { name: "添加维修项目", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "添加维修项目", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "关闭配件操作", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "核对最新资料后重试", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "DEMO 手工检测", exact: true })).toBeVisible();
  const requirements = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).workflows[id].requirements, { key: workflowKey, id: repairId });
  expect(requirements).toHaveLength(1);
  await dialog.getByRole("button", { name: "关闭配件操作", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("failed no-purchase confirmation retains its note and exact retry settles once", async ({ page }) => {
  const dialog = await openDialog(page, ["屏幕：碎裂"]);
  await dialog.locator(".repair-workflow-history > summary").filter({ hasText: "维修项目核对" }).click();
  const note = dialog.getByLabel("无需采购说明", { exact: true });
  await note.fill("DEMO 仅检测无需采购"); await failWorkflow(page);
  await dialog.getByRole("button", { name: "确认无需采购", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "维修状态未改变" })).toBeVisible();
  await expect(note).toHaveValue("DEMO 仅检测无需采购");
  await restoreWorkflow(page);
  await dialog.getByRole("button", { name: "确认无需采购", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "确认无需采购", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "关闭配件操作", exact: true })).toBeEnabled();
  const workflow = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).workflows[id], { key: workflowKey, id: repairId });
  expect(workflow.events).toHaveLength(1); expect(workflow.requirements[0].mode).toBe("none");
});

test("project changes retain the existing item draft until explicit review merges the new rows", async ({ page }) => {
  const dialog = await openDialog(page, ["屏幕：碎裂"]);
  const quote = dialog.getByLabel("屏幕报价", { exact: true });
  await quote.fill("12.34");
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!); data.records[0].faults.push("电池：续航短"); data.records[0].issue = data.records[0].faults.join("、"); data.records[0].revision++;
    localStorage.setItem(key, JSON.stringify(data)); window.dispatchEvent(new Event("chinatech-local-intake-change"));
  }, intakeKey);
  await expect(quote).toHaveValue("12.34");
  await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "核对最新资料后重试", exact: true }).click();
  await expect(quote).toHaveValue("12.34");
  await expect(dialog.getByLabel("电池报价", { exact: true })).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
});
