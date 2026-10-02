import { repairStatusOptions, type RepairStatus, type RepairTone } from "./repair-fixtures";
import type { RepairDirectoryEntry } from "./repair-intake-record";
import { repairPartsSummary, type ProcurementRecord } from "./procurement";

export type DeviceCustody = "unknown" | "store" | "customer";
export type RepairActivity = { id: string; time: string; type: "stage" | "custody" | "arrival_notice"; label: string; note: string };
export type RepairWorkflow = { revision: number; status: RepairStatus; custody: DeviceCustody; notice: { signature: string; outcome: "notified" | "unreachable" } | null; events: RepairActivity[]; updatedAt: string };
export type WorkflowCommand = { type: "stage"; status: RepairStatus; note: string } | { type: "custody"; custody: DeviceCustody } | { type: "arrival_notice"; outcome: "notified" | "unreachable"; note: string };
export const repairStageTones: Record<RepairStatus, RepairTone> = { diagnosis: "warning", awaiting_quote: "warning", awaiting_parts: "info", repairing: "progress", testing: "info", ready: "success", completed: "success", cancelled: "warning", awaiting_reply: "warning", collected_unpaid: "warning", outsourced: "info", ready_notified: "success" };
export const custodyLabels = { unknown: "保管待核对", store: "设备已留下", customer: "设备未留下" };
// SeaTable RIPARAZIONE / 进行中: STATO ascending, observed 2026-10-02.
export const workflowGroups = {
  awaiting_reply: "久等 未答复", collected_unpaid: "欠款 已拿走", outsourced: "寄修",
  processing: "IN CORSO", purchase: "下单", arrival: "到货", arrival_notified: "到货已通知",
  ready: "修好", ready_notified: "修好已通知", complete: "FATTO", cancelled: "作废",
};
export type WorkflowGroup = keyof typeof workflowGroups;
export function initialRepairWorkflow(order: RepairDirectoryEntry): RepairWorkflow {
  return { revision: 0, status: order.status, custody: order.custody ?? (order.id.startsWith("LOCAL-") ? "unknown" : "store"), notice: null, events: [], updatedAt: order.updatedAt };
}
export function partsSignature(records: ProcurementRecord[], id: string) {
  const required = records.filter(row => row.repairId === id && row.required !== false);
  const summary = repairPartsSummary(records, id);
  return summary.group === "complete" ? required.map(row => `${row.id}:${row.quantity}:${row.events.length}`).sort().join("|") : "";
}
export function arrivalNotice(workflow: RepairWorkflow, records: ProcurementRecord[], id: string) {
  if (workflow.custody === "store") return "无需到货通知";
  if (workflow.custody === "unknown") return "先核对设备保管";
  const signature = partsSignature(records, id);
  if (!signature) return "配件未到齐";
  return workflow.notice?.signature === signature && workflow.notice.outcome === "notified" ? "已通知送机" : "未通知送机";
}
export function workflowGroup(order: RepairDirectoryEntry, records: ProcurementRecord[], workflow?: RepairWorkflow): WorkflowGroup {
  const current = workflow ?? initialRepairWorkflow(order);
  const status = current.status;
  if (status === "completed") return "complete";
  if (["awaiting_reply", "collected_unpaid", "outsourced", "ready", "ready_notified", "cancelled"].includes(status)) return status as WorkflowGroup;
  if (["repairing", "testing", "awaiting_quote"].includes(status)) return "processing";
  const parts = repairPartsSummary(records, order.id);
  if (parts.group === "complete") return arrivalNotice(current, records, order.id) === "已通知送机" ? "arrival_notified" : "arrival";
  // A draft/cart or a stage label alone does not establish an actual order.
  return parts.ordered > 0 ? "purchase" : "processing";
}
export function stageChangeNeedsNote(previous: RepairStatus, next: RepairStatus) {
  return ["cancelled", "collected_unpaid"].includes(next) || ["completed", "cancelled", "collected_unpaid"].includes(previous);
}
export function applyWorkflowCommand(workflow: RepairWorkflow, command: WorkflowCommand, activity: Pick<RepairActivity, "id" | "time">, records: ProcurementRecord[], repairId: string, revision: number) {
  if (revision !== workflow.revision) throw new Error("工单已变化，请核对最新状态后重试。");
  if (!activity.id || workflow.events.some(event => event.id === activity.id)) throw new Error("重复操作未保存。");
  if (!activity.time || activity.time < workflow.updatedAt) throw new Error("操作时间不能早于上次更新。");
  let next = { ...workflow };
  let label = ""; let note = "";
  if (command.type === "stage") {
    const option = repairStatusOptions.find(option => option.value === command.status);
    if (!option) throw new Error("请选择有效维修阶段。");
    if (command.status === workflow.status) throw new Error("维修阶段没有变化。");
    note = command.note.trim();
    if (stageChangeNeedsNote(workflow.status, command.status) && !note) throw new Error("作废、欠款取走或恢复工单需要填写原因。");
    if (command.status === "collected_unpaid" && workflow.custody !== "customer") throw new Error("请先在工单详情核对设备已由客户保管，再记录欠款取走。");
    if (command.status === "ready_notified" && workflow.status !== "ready") throw new Error("请先核对工单为待取机，再记录已实际通知客户。");
    next = { ...next, status: command.status }; label = `维修阶段：${option.label}`;
  } else if (command.type === "custody") {
    if (!Object.hasOwn(custodyLabels, command.custody)) throw new Error("请选择设备实际保管情况。");
    if (command.custody === workflow.custody) throw new Error("设备保管情况没有变化。");
    next = { ...next, custody: command.custody }; label = custodyLabels[command.custody];
  } else {
    if (!["notified", "unreachable"].includes(command.outcome)) throw new Error("请选择实际沟通结果。");
    const signature = partsSignature(records, repairId);
    if (workflow.custody !== "customer" || !signature) throw new Error("仅设备未留下且必需配件到齐时记录到货通知。");
    next = { ...next, notice: { signature, outcome: command.outcome } }; label = command.outcome === "notified" ? "已成功通知送机" : "联系未接通，仍未通知"; note = command.note.trim();
  }
  return { ...next, revision: workflow.revision + 1, updatedAt: activity.time, events: [...workflow.events, { ...activity, type: command.type, label, note }] };
}
export function overlayRepair(order: RepairDirectoryEntry, workflow?: RepairWorkflow): RepairDirectoryEntry {
  if (!workflow) return order;
  return { ...order, status: workflow.status, statusLabel: repairStatusOptions.find(option => option.value === workflow.status)!.label, tone: repairStageTones[workflow.status], updatedAt: workflow.updatedAt > order.updatedAt ? workflow.updatedAt : order.updatedAt };
}
