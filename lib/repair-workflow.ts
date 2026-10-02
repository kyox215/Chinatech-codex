import { repairStatusOptions, type RepairStatus, type RepairTone } from "./repair-fixtures";
import type { RepairDirectoryEntry } from "./repair-intake-record";
import { repairPartsSummary, type ProcurementRecord } from "./procurement";

export type DeviceCustody = "unknown" | "store" | "customer";
export type RepairActivity = { id: string; time: string; type: "stage" | "custody" | "arrival_notice"; label: string; note: string };
export type RepairWorkflow = { revision: number; status: RepairStatus; custody: DeviceCustody; notice: { signature: string; outcome: "notified" | "unreachable" } | null; events: RepairActivity[]; updatedAt: string };
export type WorkflowCommand = { type: "stage"; status: RepairStatus; note: string } | { type: "custody"; custody: DeviceCustody } | { type: "arrival_notice"; outcome: "notified" | "unreachable"; note: string };
export const repairStageTones: Record<RepairStatus, RepairTone> = { diagnosis: "warning", awaiting_quote: "warning", awaiting_parts: "info", repairing: "progress", testing: "info", ready: "success", completed: "success", cancelled: "warning" };
export const custodyLabels = { unknown: "保管待核对", store: "设备已留下", customer: "设备未留下" };
export const workflowGroups = { reception: "接单", processing: "处理中", purchase: "下单", arrival: "到货", complete: "完成", cancelled: "作废" };
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
export function workflowGroup(order: RepairDirectoryEntry, records: ProcurementRecord[]): WorkflowGroup {
  if (order.status === "cancelled") return "cancelled";
  if (["ready", "completed"].includes(order.status)) return "complete";
  if (["repairing", "testing", "awaiting_quote"].includes(order.status)) return "processing";
  if (order.status === "awaiting_parts") return repairPartsSummary(records, order.id).group === "complete" ? "arrival" : "purchase";
  return "reception";
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
    if ((command.status === "cancelled" || ["completed", "cancelled"].includes(workflow.status)) && !note) throw new Error("作废或恢复工单需要填写原因。");
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
