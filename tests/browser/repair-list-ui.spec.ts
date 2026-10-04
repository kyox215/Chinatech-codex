import { test, expect, type Locator, type Page } from "@playwright/test";
import { emptyIntakeServices } from "../../lib/intake-services";
import { intakeDirectoryEntry, type IntakeReceiptData } from "../../lib/repair-intake-record";
import { prepareRepairItemEdits } from "../../lib/repair-item-editor";
import { applyWorkflowCommand, initialRepairWorkflow, type RepairWorkflow, type WorkflowCommand } from "../../lib/repair-workflow";
import { type ProcurementRecord } from "../../lib/procurement";
import { defaultStoreSettings } from "../../lib/store-settings";

const basicId = "LOCAL-B000000000000001";
const basicModel = "DEMO-LIST 双项目测试手机";
const longSupplier = "DEMO-LIST 虚构维修配件供应商 · Laboratorio Componenti Dimostrativi per Smartphone e Batterie SRL";
const longModel = "DEMO-LIST 虚构超长型号 · Smartphone Dimostrativo Ultra Max Special Edition 2026 · 屏幕及电池独立维修测试";
const time = "2026-10-01 09:00:00";

function intake(id: string, model: string): IntakeReceiptData {
  return {
    id, revision: 1, createdAt: time, updatedAt: time, previewAt: time,
    customerName: "DEMO-LIST 虚构客户", phone: "+393200009999", email: "",
    category: "手机", brand: "Apple", model, color: "", serial: "",
    faults: ["屏幕：碎裂", "电池：不充电"], issueNote: "", issue: "屏幕：碎裂、电池：不充电",
    accessories: [], services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0, custody: "customer",
  };
}

type Seed = {
  records: IntakeReceiptData[];
  workflows: Record<string, RepairWorkflow>;
  procurement: ProcurementRecord[];
  settings: typeof defaultStoreSettings;
};

async function seed(page: Page, data: Seed) {
  await page.addInitScript(value => {
    // Navigation and reload must preserve the synthetic facts saved during the test.
    if (localStorage.getItem("repair-list-ui-seeded")) return;
    localStorage.setItem("chinatech.m1.local-intakes.v1", JSON.stringify({ version: 1, records: value.records, signatures: [] }));
    localStorage.setItem("chinatech.m1.procurement.v1", JSON.stringify({ version: 1, records: value.procurement, repairUpdates: {} }));
    localStorage.setItem("chinatech.m1.repair-workflow.v1", JSON.stringify({ version: 1, workflows: value.workflows }));
    localStorage.setItem("chinatech.m1.store-settings.v1", JSON.stringify({ version: 1, settings: value.settings }));
    localStorage.setItem("repair-list-ui-seeded", "1");
  }, data);
}

async function showRows(page: Page) {
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("DEMO-LIST");
  await expect(page.locator(".repair-group-toggle").first()).toBeVisible(); for (const id of await page.locator(".repair-group-toggle[aria-expanded=false]").evaluateAll(rows => rows.map(row => row.id))) await page.locator(`#${id}`).click();
}

async function openParts(page: Page, id: string) {
  await showRows(page);
  const trigger = page.getByRole("button", { name: `${id} 供应商与配件操作`, exact: true });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "供应商与配件", exact: true })).toBeVisible();
  return trigger;
}

async function expectPageFits(page: Page) {
  expect(await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: innerWidth,
    horizontalScroll: scrollX,
  }))).toEqual(expect.objectContaining({ horizontalScroll: 0 }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth)).toBe(true);
}

async function expectUsableTarget(target: Locator) {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // Hit-test the control, so text or an adjacent control cannot cover the click area.
  const hitTest = await target.evaluate(element => {
    const box = element.getBoundingClientRect();
    const points = [[box.width / 2, box.height / 2], [5, 5], [box.width - 5, 5], [5, box.height - 5], [box.width - 5, box.height - 5]];
    const describe = (node: Element | null) => node ? { tag: node.tagName, id: node.id, class: node.getAttribute("class") } : null;
    const samples = points.map(([x, y]) => {
      const hit = document.elementFromPoint(box.left + x, box.top + y);
      return { x: box.left + x, y: box.top + y, inside: element.contains(hit), hit: describe(hit) };
    });
    const ancestors = [];
    for (let node = element.parentElement; node; node = node.parentElement) {
      const bounds = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      ancestors.push({ ...describe(node), bounds: bounds.toJSON(), scrollLeft: node.scrollLeft,
        scrollTop: node.scrollTop, overflowX: style.overflowX, overflowY: style.overflowY });
    }
    return { bounds: box.toJSON(), viewport: { width: innerWidth, height: innerHeight, scrollY }, samples, ancestors };
  });
  const row = hitTest.ancestors.find(ancestor => ancestor.tag === "ARTICLE");
  expect(row, "Control must belong to a repair row").toBeDefined();
  expect(hitTest.bounds.top >= row!.bounds.top && hitTest.bounds.bottom <= row!.bounds.bottom,
    `Control must stay inside its own row: ${JSON.stringify(hitTest)}`).toBe(true);
  expect(hitTest.samples.every(sample => sample.inside), JSON.stringify(hitTest)).toBe(true);
}

async function expectReturnedFocus(trigger: Locator) {
  await expect(trigger).toBeFocused();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  // Keyboard closing/saving must leave a visible focus indicator, without fixing a theme color.
  expect(await trigger.evaluate(element => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") &&
      ((style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none");
  })).toBe(true);
}

async function expectNoOverlap(first: Locator, second: Locator) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a!.x + a!.width <= b!.x || b!.x + b!.width <= a!.x ||
    a!.y + a!.height <= b!.y || b!.y + b!.height <= a!.y).toBe(true);
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/api/preview-session", {
    data: { email: "demo@chinatech.local", password: "Preview2026!" },
  })).status()).toBe(200);
});

test("one supplier entry keeps the remaining project visible and restores usable focus at four widths", async ({ page }) => {
  test.setTimeout(120000);
  await seed(page, { records: [intake(basicId, basicModel)], workflows: {}, procurement: [], settings: structuredClone(defaultStoreSettings) });
  await page.goto("/app/repairs");
  await openParts(page, basicId);
  const dialog = page.getByRole("dialog", { name: "供应商与配件", exact: true });
  const screen = dialog.getByRole("group", { name: "屏幕", exact: true });
  await expect(dialog.getByRole("group", { name: "电池", exact: true })).toBeVisible();
  await screen.getByRole("combobox", { name: "供应商（选填）" }).fill("MobileParts SRL");
  await screen.getByRole("option", { name: "MobileParts SRL", exact: true }).click();
  await expect(screen.getByRole("status")).toHaveText("保存后加车");
  await screen.getByLabel("屏幕报价", { exact: true }).fill("89");
  await dialog.getByRole("button", { name: "保存", exact: true }).press("Enter");
  await expect(dialog).not.toBeVisible();
  const trigger = page.getByRole("button", { name: `${basicId} 供应商与配件操作`, exact: true });
  await expectReturnedFocus(trigger);

  await page.reload();
  await showRows(page);
  const row = page.getByRole("article", { name: `${basicId} ${basicModel}`, exact: true });
  await expect(row.locator(".repair-module-row__waiting")).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.procurement.v1")!).records);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ repairId: basicId, item: "屏幕", supplierId: "demo-mobile" });
  expect(saved[0].events.map((event: { type: string }) => event.type)).toEqual(["cart_added"]);

  for (const width of [1440, 1024, 390, 375]) {
    await test.step(`${width}px: visible remaining project and a single actionable supplier entry`, async () => {
      await page.setViewportSize({ width, height: 1000 });
      await showRows(page);
      await expectPageFits(page);
      await expect(row.locator(".repair-module-row__waiting")).toHaveCount(0);
      await expect(row.locator(".repair-module-row__device small")).toHaveCount(0);
      await expect(page.locator(".repair-module-table__head").first().locator("span")).toHaveText(["工单 / 设备", "客户", "供应商 / 配件", "维修阶段", "联系 / 跟进", "负责人 / 更新"]);
      await expect(row.getByRole("button", { name: /供应商与配件操作|配件操作/ })).toHaveCount(1);
      await expect(trigger).toHaveAttribute("id", `repair-action-${basicId}`);
      await expectUsableTarget(trigger);
      await trigger.click();
      await expect(dialog).toBeVisible();
      await expect(screen.getByLabel("屏幕报价", { exact: true })).toHaveValue("89.00");
      await expect(screen.getByRole("status")).toHaveText("已加购物车");
      await expect(dialog.getByRole("group", { name: "电池", exact: true }).getByRole("status")).toHaveText("待填写");
      await expect(screen.getByRole("combobox", { name: "供应商（选填）" })).toHaveValue("MobileParts SRL");
      await expect(dialog.getByRole("group", { name: "电池", exact: true }).getByRole("combobox", { name: "供应商（选填）" })).toHaveValue("");
      await expectPageFits(page);
      await dialog.getByRole("button", { name: "取消", exact: true }).press("Enter");
      await expect(dialog).not.toBeVisible();
      await expectReturnedFocus(trigger);
      await expect(row.locator(".repair-module-row__waiting")).toHaveCount(0);
      await expectPageFits(page);
    });
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chinatech.m1.procurement.v1")!).records)).toEqual(saved);
});

test("mobile continuous rows keep two-line density, full quote follow-up and actual touch controls", async ({ page }, info) => {
  test.setTimeout(120000);
  const records = [intake("LOCAL-E000000000000001", "iPhone 16"), intake("LOCAL-E000000000000002", "Galaxy S24"), intake("LOCAL-E000000000000003", "iPhone 13")];
  records.forEach((record, index) => { record.customerName = `示例客户 ${String.fromCharCode(65 + index)}`; });
  const settings = structuredClone(defaultStoreSettings);
  const order = intakeDirectoryEntry(records[1]);
  const workflow = initialRepairWorkflow(order);
  const requirement = order.requirements!.find(row => row.title === "屏幕")!;
  const prepared = prepareRepairItemEdits({ repairId: order.id, intakeRevision: 1, workflowRevision: workflow.revision,
    items: [{ requirementId: requirement.id, requirementRevision: requirement.revision, quoteCents: 9900,
      purchase: { id: "demo-dense-supplier", revision: 0, supplierId: "demo-mobile", unitCostCents: null } }],
  }, { intake: records[1], workflow, records: [], suppliers: settings.suppliers, canEditCost: true,
    activity: { id: "demo-dense-purchase", time, actorId: "DEMO-OWNER" } });
  records[1] = prepared.intake;
  const workflows = { [order.id]: applyWorkflowCommand(prepared.workflow!, { type: "quote_contact", outcome: "awaiting_reply", note: "本地合成报价：等待客户回复。" },
    { id: "demo-dense-quote", time, actorId: "DEMO-OWNER" }, prepared.changedRecords, order.id, prepared.workflow!.revision, intakeDirectoryEntry(records[1])) };
  await seed(page, { records, workflows, procurement: prepared.changedRecords, settings });
  await page.goto("/app/repairs");
  await page.getByRole("textbox", { name: "搜索维修工单" }).fill("示例客户");
  await page.locator("#repair-group-processing").click();
  const rows = page.locator("#repair-group-rows-processing article");
  await expect(rows).toHaveCount(3);
  const unchanged = () => page.evaluate(() => ["chinatech.m1.local-intakes.v1", "chinatech.m1.procurement.v1", "chinatech.m1.repair-workflow.v1"].map(key => localStorage.getItem(key)));
  const before = await unchanged();
  for (const width of [375, 390, 414]) {
    await page.setViewportSize({ width, height: 844 });
    await expectPageFits(page);
    expect(await rows.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))).toEqual([93, 93, 93]);
    expect(await rows.first().evaluate(element => getComputedStyle(element).borderRadius)).toBe("0px");
    const row = rows.first();
    const parts = row.getByRole("button", { name: `${records[0].id} 供应商与配件操作`, exact: true });
    const stage = row.getByRole("button", { name: `${records[0].id} 更改维修阶段`, exact: true });
    const contact = row.getByRole("button", { name: `${records[0].id} 联系与跟进`, exact: true });
    await expect(row.getByText("示例客户 A", { exact: true })).toBeVisible();
    await expect(rows.nth(1).getByText("报价待客户回复", { exact: true })).toBeVisible();
    for (const control of [parts, stage, contact]) await expectUsableTarget(control);
    await expectNoOverlap(parts, contact);
    await parts.click();
    const partsDialog = page.getByRole("dialog", { name: "供应商与配件", exact: true });
    await expect(partsDialog).toBeVisible();
    await partsDialog.getByRole("button", { name: "取消", exact: true }).press("Enter");
    await expectReturnedFocus(parts);
    await stage.click();
    const stageDialog = page.getByRole("dialog", { name: "更改维修阶段", exact: true });
    await expect(stageDialog).toBeVisible();
    await stageDialog.getByRole("button", { name: "取消", exact: true }).click();
    await contact.click();
    const contactDialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
    await expect(contactDialog).toBeVisible();
    await contactDialog.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(contact).toBeFocused();
    await expect(contact).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `.local/ui-proof/repair-mobile-implementation/${info.project.name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectPageFits(page);
  await page.screenshot({ path: `.local/ui-proof/repair-mobile-implementation/${info.project.name}-1440.png` });
  await page.reload();
  await expect(page.locator("#repair-group-processing")).toHaveAttribute("aria-expanded", "true");
  expect(await unchanged()).toEqual(before);
});

function longFactsSeed(): Seed {
  const settings = structuredClone(defaultStoreSettings);
  settings.suppliers.push({ id: "demo-list-long", name: longSupplier, phone: "", website: "", active: true });
  const records: IntakeReceiptData[] = [];
  const workflows: Record<string, RepairWorkflow> = {};
  const procurement: ProcurementRecord[] = [];
  for (let index = 0; index < 3; index++) {
    const record = intake(`LOCAL-C00000000000000${index + 1}`, `${longModel} · ${index + 1}`);
    const order = intakeDirectoryEntry(record);
    let workflow = initialRepairWorkflow(order);
    let sequence = 0;
    const apply = (command: WorkflowCommand) => {
      workflow = applyWorkflowCommand(workflow, command, {
        id: `demo-list-${index}-${++sequence}`, time, actorId: "DEMO-OWNER",
      }, [], record.id, workflow.revision, order);
    };
    apply({ type: "stage", status: "ready", note: "DEMO 已在本地核对维修完成" });
    if (index !== 1) apply({ type: "pickup_notice", outcome: "notified", note: "DEMO 本地合成通知事实" });
    if (index !== 2) apply({ type: "followup", flag: "awaitingReply", value: true, note: "DEMO 本地合成久等事实" });
    if (index !== 1) {
      apply({ type: "followup", flag: "collectedUnpaid", value: true, delivered: true, unpaid: true, note: "DEMO 已核对合成交还与欠款" });
      if (index === 2) apply({ type: "followup", flag: "collectedUnpaid", value: false, note: "DEMO 合成欠款跟进已结束" });
    }
    const screen = order.requirements!.find(requirement => requirement.title === "屏幕")!;
    const prepared = prepareRepairItemEdits({
      repairId: record.id, intakeRevision: 1, workflowRevision: workflow.revision,
      items: [{ requirementId: screen.id, requirementRevision: screen.revision, quoteCents: 8900,
        purchase: { id: `demo-list-purchase-${index}`, revision: 0, supplierId: "demo-list-long", unitCostCents: null } }],
    }, { intake: record, workflow, records: [], suppliers: settings.suppliers, canEditCost: true,
      activity: { id: `demo-list-parts-${index}`, time, actorId: "DEMO-OWNER" } });
    records.push(prepared.intake);
    workflows[record.id] = prepared.workflow!;
    procurement.push(...prepared.changedRecords);
  }
  return { records, workflows, procurement, settings };
}

test("long synthetic models, suppliers and follow-up facts leave list controls readable and clickable", async ({ page }, info) => {
  test.setTimeout(120000);
  const data = longFactsSeed();
  await seed(page, data);
  await page.goto("/app/repairs");
  await showRows(page);

  for (const width of [375, 1440, 1024]) {
    await test.step(`${width}px: facts remain visible and each dialog can actually open`, async () => {
      await page.setViewportSize({ width, height: 1000 });
      await showRows(page);
      await expectPageFits(page);
      const table = page.getByRole("region", { name: "工单表格", exact: true });
      if (width === 1024) {
        expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
        await table.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        expect(await table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
        await expectPageFits(page);
      }
      await page.locator("#repair-group-rows-ready").screenshot({ path: `.local/ui-proof/repair-mobile-implementation/long-${info.project.name}-${width}.png` });
      for (const [index, record] of data.records.entries()) {
        const row = page.getByRole("article", { name: `${record.id} ${record.model}`, exact: true });
        const model = row.getByRole("link", { name: `打开 ${record.id} ${record.model} 详情`, exact: true });
        await expect(model).toBeVisible();
        await expect(row.locator(".repair-module-row__waiting")).toHaveCount(0);
        await expect(row.getByText(index === 1 ? "未通知取机" : "已通知取机", { exact: true })).toBeVisible();
        if (index !== 2) await expect(row.getByText("久等未答复", { exact: true })).toBeVisible();
        if (index === 0) await expect(row.getByText("已交还 · 欠款待跟进", { exact: true })).toBeVisible();
        if (index !== 1) await expect(row.getByText("有实际交还记录（当时未结清）", { exact: true })).toBeVisible();
        if (index === 2) await expect(row.getByText("已交还 · 欠款待跟进", { exact: true })).toHaveCount(0);

        const parts = row.getByRole("button", { name: `${record.id} 供应商与配件操作`, exact: true });
        const stage = row.getByRole("button", { name: `${record.id} 更改维修阶段`, exact: true });
        const contact = row.getByRole("button", { name: `${record.id} 联系与跟进`, exact: true });
        await expect(parts.getByText(longSupplier, { exact: true })).toBeVisible();
        if (width < 768) expect(await parts.locator("strong").evaluate(element =>
          element.scrollWidth > element.clientWidth && getComputedStyle(element).textOverflow === "ellipsis")).toBe(true);
        await expectNoOverlap(model, stage);
        await expectNoOverlap(parts, stage);
        await expectNoOverlap(parts, contact);
        expect(await parts.evaluate(element => {
          const text = element.querySelector("strong")!.getBoundingClientRect();
          const button = element.getBoundingClientRect();
          return text.left >= button.left && text.right <= button.right &&
            text.top >= button.top && text.bottom <= button.bottom;
        })).toBe(true);
        await expectUsableTarget(parts);
        await parts.click();
        const partsDialog = page.getByRole("dialog", { name: "供应商与配件", exact: true });
        await expect(partsDialog).toBeVisible();
        await expect(partsDialog.getByRole("group", { name: "屏幕", exact: true }).getByRole("combobox", { name: "供应商（选填）" })).toHaveValue(longSupplier);
        await partsDialog.getByRole("button", { name: "取消", exact: true }).press("Enter");
        await expect(partsDialog).not.toBeVisible();
        await expectReturnedFocus(parts);

        await expectUsableTarget(stage);
        await stage.click();
        const stageDialog = page.getByRole("dialog", { name: "更改维修阶段", exact: true });
        await expect(stageDialog).toBeVisible();
        await expect(stageDialog.getByRole("button", { name: "待取机", exact: true })).toHaveAttribute("aria-pressed", "true");
        await stageDialog.getByRole("button", { name: "取消", exact: true }).click();
        await expect(stageDialog).not.toBeVisible();

        await expectUsableTarget(contact);
        await contact.click();
        const contactDialog = page.getByRole("dialog", { name: "工单联系与跟进", exact: true });
        await expect(contactDialog).toBeVisible();
        await expect(contactDialog.getByRole("button", { name: "已实际成功通知取机", exact: true })).toBeEnabled();
        await contactDialog.getByRole("button", { name: "关闭", exact: true }).click();
        await expect(contactDialog).not.toBeVisible();
        await expect(contact).toBeFocused();
        await expect(contact).toBeInViewport({ ratio: 1 });
        await expectPageFits(page);
      }
    });
  }
  const unchanged = await page.evaluate(() => ({
    records: JSON.parse(localStorage.getItem("chinatech.m1.procurement.v1")!).records,
    workflows: JSON.parse(localStorage.getItem("chinatech.m1.repair-workflow.v1")!).workflows,
  }));
  expect(unchanged.records).toEqual(data.procurement);
  expect(unchanged.workflows).toEqual(data.workflows);
});

test("detail demand, parts and signature flow together independently of a tall sidebar", async ({ page }) => {
  test.setTimeout(90000);
  const records = [intake("LOCAL-D000000000000001", "DEMO-LIST 少项目"), intake("LOCAL-D000000000000002", "DEMO-LIST 多项目")];
  records[1].faults!.push("摄像头：模糊", "DEMO 扬声器", "DEMO 按键", "DEMO 其他维修");
  for (const record of records) {
    record.issue = record.faults!.join("、");
    record.itemQuotes = record.faults!.map(fault => ({ item: fault.split("：")[0], amountCents: 5000 }));
    record.accessories = Array.from({ length: 12 }, (_, index) => `DEMO 随件 ${index + 1} · 本地合成附件说明`);
  }
  await seed(page, { records, workflows: {}, procurement: [], settings: structuredClone(defaultStoreSettings) });
  for (const record of records) {
    await page.goto(`/app/repairs/${record.id}`);
    const signature = page.getByRole("region", { name: "客户签名", exact: true });
    await expect(signature.getByRole("button", { name: "添加签名", exact: true })).toBeEnabled();
    for (const width of [1440, 1024, 390, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await expectPageFits(page);
      const gaps = await page.evaluate(() => {
        const main = document.querySelector(".intake-review__main")!;
        const issue = main.querySelector(".intake-review__issue-section")!.getBoundingClientRect();
        const related = main.querySelector(".intake-review__related")!;
        const [parts, signature] = [...related.children].map(element => element.getBoundingClientRect());
        return { beforeParts: parts.top - issue.bottom, beforeSignature: signature.top - parts.bottom };
      });
      expect(gaps.beforeParts).toBe(width >= 768 ? 14 : 10);
      expect(gaps.beforeSignature).toBe(width >= 768 ? 14 : 10);
    }
    const before = await page.evaluate(() => localStorage.getItem("chinatech.m1.local-intakes.v1"));
    await signature.getByRole("button", { name: "添加签名", exact: true }).click();
    await expect(signature.getByRole("button", { name: "取消", exact: true })).toBeVisible();
    await signature.getByRole("button", { name: "取消", exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem("chinatech.m1.local-intakes.v1"))).toBe(before);
  }
});
