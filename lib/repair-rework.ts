import { emptyIntakeServices } from "./intake-services";
import { localIntakeId, validLocalIntake, type IntakePolicy, type IntakeReceiptData, type RepairOrigin } from "./repair-intake-record";
import { hasCurrentRepairHandover, type RepairWorkflow } from "./repair-workflow";

export type CreateRepairReworkInput = {
  sourceId: string;
  sourceRevision: number;
  workflowRevision: number;
  repairId: string;
  reason: string;
  custody: "store" | "customer";
};

export class RepairReworkError extends Error {
  constructor(message: string, public status: 400 | 404 | 409 = 400) { super(message); }
}

export function validateRepairReworkInput(value: unknown): asserts value is CreateRepairReworkInput {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["sourceId", "sourceRevision", "workflowRevision", "repairId", "reason", "custody"].includes(key))) throw new RepairReworkError("返修请求包含无效字段。");
  const input = value as CreateRepairReworkInput;
  if (typeof input.sourceId !== "string" || !input.sourceId.trim() || input.sourceId.length > 100
    || typeof input.repairId !== "string" || !localIntakeId(input.repairId) || input.sourceId === input.repairId) throw new RepairReworkError("请核对原工单和新返修编号。");
  if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 1
    || !Number.isSafeInteger(input.workflowRevision) || input.workflowRevision < 0) throw new RepairReworkError("请核对原工单版本。");
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 2000) throw new RepairReworkError("请填写本次返修原因，最多2000字。");
  if (input.custody !== "store" && input.custody !== "customer") throw new RepairReworkError("请核对本次设备是否留下。");
}

export function canCreateRepairRework(workflow: RepairWorkflow) {
  return workflow.status === "completed" || hasCurrentRepairHandover(workflow);
}

/** Ordinary intake edits may retain an established source, but cannot create or change it. */
export function repairOriginForSave(draft: IntakeReceiptData, previous?: IntakeReceiptData): RepairOrigin | undefined {
  if (draft.repairOrigin !== undefined && (!previous?.repairOrigin
    || draft.repairOrigin.repairId !== previous.repairOrigin.repairId
    || draft.repairOrigin.reason !== previous.repairOrigin.reason)) throw new RepairReworkError("返修来源只能通过原工单创建，不能新增或改写。");
  return previous?.repairOrigin ? structuredClone(previous.repairOrigin) : undefined;
}

/** All facts come from the current, authorized source; no client customer/device snapshot is accepted. */
export function buildRepairRework(input: CreateRepairReworkInput, source: IntakeReceiptData | undefined, workflow: RepairWorkflow, policy: IntakePolicy, time: string): IntakeReceiptData {
  validateRepairReworkInput(input);
  if (!source || source.id !== input.sourceId) throw new RepairReworkError("原工单不存在或不属于当前门店。", 404);
  if ((source.revision ?? 1) !== input.sourceRevision || workflow.revision !== input.workflowRevision) throw new RepairReworkError("原工单或维修状态已变化，请重新打开并核对。", 409);
  if (!canCreateRepairRework(workflow)) throw new RepairReworkError("只能从维修结束或已明确交还的原单建立返修。", 409);
  const reason = input.reason.trim();
  const data: IntakeReceiptData = {
    id: input.repairId, revision: 1, createdAt: time, updatedAt: time, previewAt: time,
    policy: structuredClone(policy), repairOrigin: { repairId: source.id, reason }, custody: input.custody,
    customerName: source.customerName, phone: source.phone, email: source.email,
    category: source.category, brand: source.brand, model: source.model, color: source.color, serial: source.serial,
    issue: reason, accessories: [], services: structuredClone(emptyIntakeServices), priority: "普通", photoCount: 0,
  };
  if (!validLocalIntake(data)) throw new RepairReworkError("原客户或设备资料不完整，请先核对原工单。");
  return data;
}
