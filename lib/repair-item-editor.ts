import { intakeDirectoryEntry, validLocalIntake, type IntakeReceiptData } from "./repair-intake-record";
import { updateItemQuotes, validItemQuotes } from "./repair-item-pricing";
import { currentRepairRequirements, validateRepairRequirements } from "./repair-requirements";
import { validateWorkflowExtensions, assertRepairProcurementOpen, type RepairWorkflow } from "./repair-workflow";
import { appendProcurementEvent, isPreorder, procurementStatus, validateProcurementDraft, type ProcurementRecord } from "./procurement";
import type { StoreSettings } from "./store-settings";

export type RepairItemEdit = {
  requirementId: string;
  requirementRevision: number;
  quoteCents: number | null;
  purchase?: { id: string; revision: number; supplierId: string; unitCostCents: number | null };
};
export type RepairItemsEdit = { repairId: string; intakeRevision: number; workflowRevision: number; items: RepairItemEdit[] };
export class RepairItemEditError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100 && value === value.trim();
const revision = (value: unknown, minimum = 0) => Number.isSafeInteger(value) && Number(value) >= minimum;
const amount = (value: unknown) => value === null || (Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100000000);
const fields = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));

export function validateRepairItemsEdit(value: unknown): asserts value is RepairItemsEdit {
  if (!object(value) || !fields(value, ["repairId", "intakeRevision", "workflowRevision", "items"]) || !identifier(value.repairId) || !revision(value.intakeRevision, 1) || !revision(value.workflowRevision) || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) throw new RepairItemEditError("须保存当前工单的1–100项维修项目，并核对打开时版本。");
  const requirements = new Set<string>(), purchases = new Set<string>();
  for (const item of value.items) {
    if (!object(item) || !fields(item, ["requirementId", "requirementRevision", "quoteCents", "purchase"]) || !identifier(item.requirementId) || !revision(item.requirementRevision, 1) || !amount(item.quoteCents) || requirements.has(item.requirementId)) throw new RepairItemEditError("维修项目重复、版本或客户报价无效。");
    requirements.add(item.requirementId);
    if (item.purchase !== undefined) {
      const purchase = item.purchase;
      if (!object(purchase) || !fields(purchase, ["id", "revision", "supplierId", "unitCostCents"]) || !identifier(purchase.id) || !revision(purchase.revision) || !identifier(purchase.supplierId) || !amount(purchase.unitCostCents) || purchases.has(purchase.id)) throw new RepairItemEditError("采购编号重复、供应商、进价或采购版本无效。");
      purchases.add(purchase.id);
    }
  }
}

/** Build every changed ledger before either the server transaction or preview persistence writes. */
export function prepareRepairItemEdits(input: RepairItemsEdit, context: {
  intake: IntakeReceiptData;
  workflow: RepairWorkflow;
  records: readonly ProcurementRecord[];
  suppliers: StoreSettings["suppliers"];
  canEditCost: boolean;
  activity: { id: string; time: string; actorId: string };
}) {
  validateRepairItemsEdit(input);
  const { intake, workflow, records, suppliers, canEditCost, activity } = context;
  if (intake.id !== input.repairId) throw new RepairItemEditError("关联工单不存在。", 404);
  if ((intake.revision ?? 1) !== input.intakeRevision || workflow.revision !== input.workflowRevision) throw new RepairItemEditError("工单、报价或维修项目已变化，请重新核对。", 409);
  const order = intakeDirectoryEntry(intake), requirements = currentRepairRequirements(order, workflow);
  validateRepairRequirements(requirements);
  const quotes = new Map((intake.itemQuotes ?? []).map(row => [row.item, row.amountCents]));
  for (const row of requirements) if (!quotes.has(row.title)) quotes.set(row.title, null);
  const selectedTitles = new Map<string, number | null>(), purchasedRequirements = new Set<string>(), changedRecords: ProcurementRecord[] = [];
  for (const [index, edit] of input.items.entries()) {
    const requirement = requirements.find(row => row.id === edit.requirementId);
    if (!requirement || requirement.revision !== edit.requirementRevision) throw new RepairItemEditError("维修项目或接单要求已变化，请重新核对关联。", 409);
    if (selectedTitles.has(requirement.title) && selectedTitles.get(requirement.title) !== edit.quoteCents) throw new RepairItemEditError("同名维修项目不能保存互相冲突的报价。");
    selectedTitles.set(requirement.title, edit.quoteCents);
    quotes.set(requirement.title, edit.quoteCents);
    if (!edit.purchase) continue;
    const linked = records.filter(row => row.repairId === intake.id && row.requirementId === requirement.id);
    if (linked.length > 1) throw new RepairItemEditError("本项目已有多条采购记录，供应商及进价须保留；报价可以独立保存。", 409);
    if (linked.length === 1 && linked[0].id !== edit.purchase.id) throw new RepairItemEditError("本项目已有采购记录，请核对原记录，不能重复创建。", 409);
    const purchase = edit.purchase, previous = records.find(row => row.id === purchase.id);
    if ((previous?.events.length ?? 0) !== purchase.revision) throw new RepairItemEditError("采购记录已变化，请重新核对。", 409);
    if (previous && (previous.repairId !== intake.id || previous.requirementId !== requirement.id || previous.requirementRevision !== requirement.revision)) throw new RepairItemEditError("原采购项目关联已变化，请先完整核对项目配件。", 409);
    if (previous && !isPreorder(previous)) throw new RepairItemEditError("已下单配件不能改写；报价可以独立保存。", 409);
    if (!canEditCost && purchase.unitCostCents !== null) throw new RepairItemEditError("当前账号不能编辑采购成本。", 403);
    const supplier = suppliers.find(row => row.id === purchase.supplierId && row.active);
    if (!supplier) throw new RepairItemEditError("供应商已变化，请重新选择有效的门店供应商。", 409);
    if (records.some(row => row.repairId === intake.id && row.requirementId === requirement.id && row.required !== false && row.requirementRevision !== requirement.revision)) throw new RepairItemEditError("本项目旧配件要求已变化，请先完整核对关联。", 409);
    const draft: ProcurementRecord = previous ? {
      ...previous, supplierId: supplier.id, supplier: supplier.name,
      unitCostCents: canEditCost ? purchase.unitCostCents : previous.unitCostCents, events: [],
    } : {
      id: purchase.id, repairId: intake.id, item: requirement.title, specification: requirement.request,
      supplierId: supplier.id, supplier: supplier.name, quantity: 1, required: true,
      unitCostCents: canEditCost ? purchase.unitCostCents : null, expectedAt: "", reference: "", events: [],
      requirementId: requirement.id, requirementRevision: requirement.revision,
    };
    validateProcurementDraft(draft);
    let next = { ...draft, events: previous?.events ?? [] };
    if (previous) next = appendProcurementEvent(next, { ...activity, id: `${activity.id}:${index + 1}:details`, type: "details_changed", quantity: 0, note: "项目供应商及配件资料已核对，保留原采购事实。" });
    if (procurementStatus(next) !== "cart") next = appendProcurementEvent(next, { ...activity, id: `${activity.id}:${index + 1}:cart`, type: "cart_added", quantity: 0, note: "已选供应商并加入采购车。" });
    changedRecords.push(next);
    purchasedRequirements.add(requirement.id);
  }
  const nextQuotes = [...quotes].map(([item, amountCents]) => ({ item, amountCents }));
  if (!validItemQuotes(nextQuotes)) throw new RepairItemEditError("维修报价资料无效。");
  const pricing = updateItemQuotes(intake.itemQuotes, nextQuotes, intake.itemQuoteHistory, activity);
  const nextIntake = { ...intake, ...pricing, revision: (intake.revision ?? 1) + 1, updatedAt: activity.time };
  if (!validLocalIntake(nextIntake)) throw new RepairItemEditError("接机报价资料无效。");
  let nextWorkflow: RepairWorkflow | undefined;
  if (changedRecords.length) {
    assertRepairProcurementOpen(order,workflow);
    if (workflow.events.length >= 1000 || workflow.events.some(event => event.id === activity.id) || activity.time < workflow.updatedAt) throw new RepairItemEditError("维修历史重复、已达上限或时间无效。");
    const nextRequirements = requirements.map(row => purchasedRequirements.has(row.id) ? {
      ...row, sourceFingerprint: order.requirements?.find(source => source.id === row.id)?.sourceFingerprint,
      deviceFingerprint: order.deviceFingerprint, mode: "parts" as const, confirmed: true,
    } : row);
    validateRepairRequirements(nextRequirements);
    nextWorkflow = { ...workflow, requirements: nextRequirements, revision: workflow.revision + 1, updatedAt: activity.time,
      events: [...workflow.events, { ...activity, type: "requirement", label: `${changedRecords.length}项维修配件已选供应商`, note: "已核对项目要求并加入采购车，尚未下单。" }] };
    validateWorkflowExtensions(nextWorkflow);
  }
  return { intake: nextIntake, workflow: nextWorkflow, changedRecords };
}

/** localStorage has no transaction: compensate a failed multi-envelope write before publishing. */
export function persistRepairItemEnvelopes(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, entries: { key: string; before: string | null; value: string }[]) {
  for (const entry of entries) if (storage.getItem(entry.key) !== entry.before) throw new RepairItemEditError("本地资料已变化，请重新核对。", 409);
  try { for (const entry of entries) storage.setItem(entry.key, entry.value); }
  catch (reason) {
    let restored = true;
    for (const entry of entries) {
      try { if (entry.before === null) storage.removeItem(entry.key); else storage.setItem(entry.key, entry.before); }
      catch { restored = false; }
    }
    if (!restored) throw new RepairItemEditError("本地保存及恢复失败，请保留草稿并核对各项记录后重试。");
    throw reason;
  }
}
