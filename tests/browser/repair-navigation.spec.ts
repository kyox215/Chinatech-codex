import { test, expect, type Page } from "@playwright/test";
import { emptyIntakeServices } from "../../lib/intake-services";
import { intakeDirectoryEntry, type IntakeReceiptData } from "../../lib/repair-intake-record";
import { applyWorkflowCommand, initialRepairWorkflow, type RepairWorkflow } from "../../lib/repair-workflow";
import { repairListViewStorageKey } from "../../lib/repair-list-view-state";
import { defaultStaffData } from "../../lib/staff";

const time = "2026-10-01 09:00:00";
const firstId = "LOCAL-E000000000000000";
const workflowKey = "chinatech.m1.repair-workflow.v1";
const intakeKey = "chinatech.m1.local-intakes.v1";
const procurementKey = "chinatech.m1.procurement.v1";
const staffKey = "chinatech.m1.staff.v1";

function intake(index: number): IntakeReceiptData {
  return {
    id: `LOCAL-E${index.toString(16).toUpperCase().padStart(15, "0")}`,
    revision: 1, createdAt: time, updatedAt: time, previewAt: time,
    customerName: "DEMO-NAV 虚构客户", phone: `+39320000${String(index).padStart(4, "0")}`, email: "",
    category: "手机", brand: "Apple", model: `DEMO-NAV 合成测试手机 ${String(index + 1).padStart(2, "0")}`,
    color: "", serial: "", faults: ["屏幕：碎裂"], issueNote: "", issue: "屏幕：碎裂",
    accessories: [], services: structuredClone(emptyIntakeServices),
    priority: index % 3 === 0 ? "紧急" : index % 3 === 1 ? "优先" : "普通",
    photoCount: 0, custody: "customer", itemQuotes: [{ item: "屏幕", amountCents: 12000 }],
  };
}

async function seed(page: Page, count = 24, readyForPickup = false) {
  const records = Array.from({ length: count }, (_, index) => intake(index));
  const workflows: Record<string, RepairWorkflow> = {};
  for (const record of records) {
    const order = intakeDirectoryEntry(record);
    let workflow = initialRepairWorkflow(order);
    if (readyForPickup) for(const item of order.requirements ?? []) workflow=applyWorkflowCommand(workflow,{type:"requirement",item:{...item,mode:"none",confirmed:true},note:"DEMO仅人工处理，不需采购"},{id:`demo-none-${record.id}-${item.id}`,time:"2026-10-01 09:00:30",actorId:"DEMO-OWNER"},[],record.id,workflow.revision,order);
    workflow = applyWorkflowCommand(workflow, { type: "stage", status: readyForPickup ? "ready" : "awaiting_quote", note: "" },
      { id: `demo-stage-${record.id}`, time: "2026-10-01 09:01:00", actorId: "DEMO-OWNER" }, [], record.id, workflow.revision, order);
    if (readyForPickup) {
      workflow = applyWorkflowCommand(workflow, { type: "pickup_notice", outcome: "notified", note: "DEMO 已实际通知取机" },
        { id: `demo-pickup-${record.id}`, time: "2026-10-01 09:02:00", actorId: "DEMO-OWNER" }, [], record.id, workflow.revision, order);
      workflow.notice = { signature: "DEMO-EXISTING-ARRIVAL", outcome: "unreachable" };
    }
    workflows[record.id] = workflow;
  }
  await page.addInitScript(data => {
    if (localStorage.getItem("repair-navigation-seeded")) return;
    localStorage.setItem("repair-navigation-seeded", "1");
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: data.records, signatures: [] }));
    localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: data.workflows }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: [], repairUpdates: {} }));
    localStorage.setItem("chinatech.m1.staff.v1", JSON.stringify({ version: 1, data: data.staff }));
  }, { records, workflows, staff: structuredClone(defaultStaffData) });
}

async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^筛选/ });
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}

async function openGroup(page: Page, id: string) {
  const toggle = page.locator(`#repair-group-${id}`);
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
}

async function configureView(page: Page) {
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO-NAV");
  await openFilters(page);
  await page.getByLabel("维修阶段筛选", { exact: true }).selectOption("awaiting_quote");
  await page.getByLabel("配件状态筛选", { exact: true }).selectOption("draft");
  await page.getByLabel("工单分组", { exact: true }).selectOption("parts");
  await page.getByLabel("工单排序", { exact: true }).selectOption("priority");
  await openGroup(page, "cart");
  await openGroup(page, "draft");
  await expect(page.locator("#repair-group-unrecorded")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#repair-group-draft small")).toHaveText("24");
}

async function expectConfiguredView(page: Page, query = "DEMO-NAV") {
  await expect(page.getByRole("textbox", { name: "搜索维修工单" })).toHaveValue(query);
  await expect(page.getByRole("button", { name: /^筛选/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("维修阶段筛选", { exact: true })).toHaveValue("awaiting_quote");
  await expect(page.getByLabel("配件状态筛选", { exact: true })).toHaveValue("draft");
  await expect(page.getByLabel("工单分组", { exact: true })).toHaveValue("parts");
  await expect(page.getByLabel("工单排序", { exact: true })).toHaveValue("priority");
  await expect(page.locator("#repair-group-cart")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#repair-group-draft")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#repair-group-unrecorded")).toHaveAttribute("aria-expanded", "false");
}

async function rawFacts(page: Page) {
  return page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), [intakeKey, workflowKey, procurementKey]);
}

async function quoteWorkflow(page: Page) {
  return page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).workflows[id] as RepairWorkflow, { key: workflowKey, id: firstId });
}

async function showSyntheticRows(page: Page) {
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO-NAV");
  await page.getByLabel("工单分组", { exact: true }).selectOption("none");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");await page.getByRole("button",{name:"填入演示账号",exact:true}).click();await page.getByRole("button",{name:"登录工作台",exact:true}).click();await expect(page).toHaveURL(/\/app\/dashboard$/);
});

for (const method of ["page return", "browser back"] as const) {
  test(`${method} restores search, filters, ordering, open groups and both scroll positions`, async ({ page }) => {
    const desktop = !test.info().project.use.isMobile;
    if (desktop) await page.setViewportSize({ width: 1024, height: 900 });
    await seed(page);
    await page.goto("/app/repairs");
    await configureView(page);
    const beforeFacts = await rawFacts(page);
    const table = page.getByRole("region", { name: "工单表格", exact: true });
    const order = await table.locator(".repair-row-link").evaluateAll(elements => elements.map(element => element.getAttribute("href")));
    const link = table.locator(".repair-row-link").nth(12);
    const href = await link.getAttribute("href");
    await link.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 260, behavior: "instant" }));
    if (desktop) {
      expect(await table.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(80);
      await table.evaluate(element => { element.scrollLeft = 80; });
    }
    const position = await page.evaluate(() => ({ scrollY, scrollLeft: document.querySelector<HTMLElement>('[aria-label="工单表格"]')!.scrollLeft }));
    expect(position.scrollY).toBeGreaterThan(300);
    if (desktop) expect(position.scrollLeft).toBe(80);
    const linkBox = (await link.boundingBox())!, tableBox = (await table.boundingBox())!;
    const left = Math.max(linkBox.x, tableBox.x), right = Math.min(linkBox.x + linkBox.width, tableBox.x + tableBox.width);
    expect(right - left).toBeGreaterThan(8);
    // A physical pointer click preserves the intentionally scrolled viewport; locator auto-scroll would reset the table first.
    await page.mouse.click((left + right) / 2, linkBox.y + linkBox.height / 2);
    await expect(page).toHaveURL(href!);
    await expect(page.getByRole("heading", { name: "工单详情", exact: true })).toBeVisible();
    if (method === "page return") await page.getByRole("link", { name: "返回工单列表", exact: true }).click();
    else await page.goBack();
    await expect(page).toHaveURL("/app/repairs");
    await expectConfiguredView(page);
    await expect.poll(() => page.evaluate(y => Math.abs(scrollY - y), position.scrollY)).toBeLessThanOrEqual(2);
    await expect.poll(() => table.evaluate((element, left) => Math.abs(element.scrollLeft - left), position.scrollLeft)).toBeLessThanOrEqual(2);
    expect(await table.locator(".repair-row-link").evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(order);
    expect(await rawFacts(page)).toEqual(beforeFacts);
  });
}

test("cold refresh retains non-sensitive view settings while search text never enters session storage", async ({ page }) => {
  await seed(page);
  await page.goto("/app/repairs");
  await configureView(page);
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO-NAV 虚构客户");
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).view.sort, repairListViewStorageKey)).toBe("priority");
  const raw = await page.evaluate(key => sessionStorage.getItem(key)!, repairListViewStorageKey);
  expect(raw).not.toContain("DEMO-NAV 虚构客户");
  expect(raw).not.toContain('"query"');
  expect(raw).not.toContain('"customer"');
  const facts = await rawFacts(page);
  await page.reload();
  await expectConfiguredView(page, "");
  expect(await rawFacts(page)).toEqual(facts);
});

test("changing identity or member version applies defaults and cannot revive the old scoped view", async ({ page }) => {
  await seed(page);
  await page.goto("/app/repairs");
  await configureView(page);
  const oldScope = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).scope, repairListViewStorageKey);
  await page.evaluate(key => {
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.data.currentId = "DEMO-VIEWER";
    localStorage.setItem(key, JSON.stringify(raw)); window.dispatchEvent(new Event("chinatech-staff-change"));
  }, staffKey);
  await expect(page.getByRole("textbox", { name: "搜索维修工单" })).toHaveValue("");
  await expect(page.getByLabel("工单分组", { exact: true })).toHaveValue("workflow");
  await expect(page.getByLabel("工单排序", { exact: true })).toHaveValue("updated");
  await expect(page.getByRole("button", { name: /^筛选/ })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.repair-group-toggle[aria-expanded="false"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).scope, repairListViewStorageKey)).not.toBe(oldScope);
  await page.evaluate(key => {
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.data.currentId = "DEMO-OWNER";
    localStorage.setItem(key, JSON.stringify(raw)); window.dispatchEvent(new Event("chinatech-staff-change"));
  }, staffKey);
  await expect(page.getByRole("textbox", { name: "搜索维修工单" })).toHaveValue("");
  await expect(page.getByLabel("工单分组", { exact: true })).toHaveValue("workflow");
  await showSyntheticRows(page);
  await page.getByLabel("工单排序", { exact: true }).selectOption("created");
  await page.evaluate(key => {
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.data.members.find((member: { id: string }) => member.id === raw.data.currentId).revision++;
    localStorage.setItem(key, JSON.stringify(raw)); window.dispatchEvent(new Event("chinatech-staff-change"));
  }, staffKey);
  await expect(page.getByRole("textbox", { name: "搜索维修工单" })).toHaveValue("");
  await expect(page.getByLabel("工单分组", { exact: true })).toHaveValue("workflow");
  await expect(page.getByLabel("工单排序", { exact: true })).toHaveValue("updated");
});

test("quote contact appends real local history and remains shared by list, detail and refresh without changing operational facts", async ({ page }) => {
  await seed(page, 1, true);
  await page.goto("/app/repairs");
  await showSyntheticRows(page);
  const original = await quoteWorkflow(page), facts = await rawFacts(page);
  const row = page.getByRole("article", { name: `${firstId} DEMO-NAV 合成测试手机 01`, exact: true });
  const outcomes = [{ label: "报价待客户回复", outcome: "awaiting_reply" }, { label: "报价联系未接通", outcome: "unreachable" }, { label: "已沟通报价", outcome: "contacted" }];
  for (const [index, outcome] of outcomes.entries()) {
    await row.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
    await expect(dialog.locator(".repair-quote-context strong")).toHaveText("€120.00");
    await dialog.getByLabel("联系跟进说明", { exact: true }).fill(`DEMO 报价沟通事实 ${index + 1}`);
    await dialog.getByRole("button", { name: outcome.label, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.locator(".repair-contact__quote")).toHaveText(outcome.label);
    await expect(row).toContainText("已通知取机");
    await expect(row.getByRole("button", { name: `${firstId} 更改维修阶段`, exact: true })).toHaveText("已通知");
    const saved = await quoteWorkflow(page);
    expect(saved.quoteContact).toEqual(expect.objectContaining({ outcome: outcome.outcome, note: `DEMO 报价沟通事实 ${index + 1}`, actorId: "DEMO-OWNER" }));
    expect(saved.revision).toBe(original.revision + index + 1);
    expect(saved.events.at(-1)).toEqual(expect.objectContaining({ type: "quote_contact", label: outcome.label, note: `DEMO 报价沟通事实 ${index + 1}` }));
    for (const key of ["status", "custody", "notice", "pickupNotice", "readyCycle", "followUp", "handedOver"] as const) expect(saved[key]).toEqual(original[key]);
  }
  await row.getByRole("link", { name: `打开 ${firstId} DEMO-NAV 合成测试手机 01 详情`, exact: true }).click();
  const overview = page.locator('section[aria-label="工单概况"]');
  await expect(overview.locator(".repair-contact__quote")).toHaveText("已沟通报价");
  await overview.getByText("状态与操作历史", { exact: true }).click();
  await expect(overview.getByText("DEMO 报价沟通事实 1", { exact: true })).toBeVisible();
  await expect(overview.getByText("DEMO 报价沟通事实 3", { exact: true })).toBeVisible();
  await overview.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
  await dialog.getByText("报价沟通历史 · 3", { exact: true }).click();
  for (const index of [1, 2, 3]) await expect(dialog.getByText(`DEMO 报价沟通事实 ${index}`, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "返回工单列表", exact: true }).click();
  await expect(page).toHaveURL("/app/repairs");
  await expect(page.getByRole("heading", { name: "维修工单", exact: true })).toBeVisible();
  await page.reload();
  await showSyntheticRows(page);
  await expect(row.locator(".repair-contact__quote")).toHaveText("已沟通报价");
  const after = await rawFacts(page);
  expect(after[intakeKey]).toBe(facts[intakeKey]); expect(after[procurementKey]).toBe(facts[procurementKey]);
  expect((await quoteWorkflow(page)).events.filter(event => event.type === "quote_contact")).toHaveLength(3);
});

test("empty or cancelled quote communication never changes the work order", async ({ page }) => {
  await seed(page, 1, true);
  await page.goto("/app/repairs"); await showSyntheticRows(page);
  const facts = await rawFacts(page), trigger = page.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
  for (const label of ["已沟通报价", "报价联系未接通", "报价待客户回复"]) await expect(dialog.getByRole("button", { name: label, exact: true })).toBeDisabled();
  await dialog.getByLabel("联系跟进说明", { exact: true }).fill("   ");
  await expect(dialog.getByRole("button", { name: "报价待客户回复", exact: true })).toBeDisabled();
  await dialog.getByLabel("联系跟进说明", { exact: true }).fill("DEMO 取消而不保存");
  await expect(dialog.getByRole("button", { name: "报价待客户回复", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  expect(await rawFacts(page)).toEqual(facts);
  await trigger.click(); await dialog.getByLabel("联系跟进说明", { exact: true }).fill("DEMO Escape 取消");
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  expect(await rawFacts(page)).toEqual(facts);
});

test("revoking repair edit closes a quote draft and a viewer cannot open it from list or detail", async ({ page }) => {
  await seed(page, 1, true);
  await page.goto("/app/repairs"); await showSyntheticRows(page);
  const facts = await rawFacts(page);
  await page.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
  await dialog.getByLabel("联系跟进说明", { exact: true }).fill("DEMO 撤权后不得保存");
  await page.evaluate(key => {
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.data.currentId = "DEMO-VIEWER";
    localStorage.setItem(key, JSON.stringify(raw)); window.dispatchEvent(new Event("chinatech-staff-change"));
  }, staffKey);
  await expect(dialog).not.toBeVisible();
  await showSyntheticRows(page);
  await expect(page.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: `打开 ${firstId} DEMO-NAV 合成测试手机 01 详情`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "工单详情", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `${firstId} 联系与跟进`, exact: true })).toHaveCount(0);
  expect(await rawFacts(page)).toEqual(facts);
});
