import { repairStatusOptions, type RepairStatus, type RepairTone } from "./repair-fixtures";
import type { RepairDirectoryEntry } from "./repair-intake-record";
import { repairPartsSummary, procurementStatus, arrivedQuantity, type ProcurementRecord } from "./procurement";
import { currentRepairRequirements, validateRepairRequirements, type RepairRequirement, type RequirementSource } from "./repair-requirements";

export type DeviceCustody = "unknown" | "store" | "customer";
export const quoteContactLabels = { contacted: "已沟通报价", unreachable: "报价联系未接通", awaiting_reply: "报价待客户回复" };
export type QuoteContactOutcome = keyof typeof quoteContactLabels;
export type RepairActivity = { id: string; time: string; type: "stage" | "custody" | "arrival_notice" | "pickup_notice" | "requirement" | "followup" | "quote_contact"; label: string; note: string; actorId?: string };
export type RepairWorkflow = { revision: number; status: RepairStatus; custody: DeviceCustody; notice: { signature: string; outcome: "notified" | "unreachable" } | null; events: RepairActivity[]; updatedAt: string; requirements?: RepairRequirement[]; readyCycle?: string; pickupNotice?: { cycle: string; outcome: "notified" | "unreachable" }; quoteContact?: { outcome: QuoteContactOutcome; time: string; note: string; actorId?: string }; followUp?: { awaitingReply: boolean; collectedUnpaid: boolean }; handedOver?: { time: string; actorId?: string; unpaid: boolean } };
export type WorkflowCommand = { type: "stage"; status: RepairStatus; note: string } | { type: "custody"; custody: DeviceCustody } | { type: "arrival_notice" | "pickup_notice"; outcome: "notified" | "unreachable"; note: string } | { type: "quote_contact"; outcome: QuoteContactOutcome; note: string } | { type: "requirement"; item: RepairRequirement; note: string } | { type: "followup"; flag: "awaitingReply" | "collectedUnpaid"; value: boolean; note: string; delivered?: boolean; unpaid?: boolean };
export const repairStageTones: Record<RepairStatus, RepairTone> = { diagnosis: "warning", awaiting_quote: "warning", awaiting_parts: "info", repairing: "progress", testing: "info", ready: "success", completed: "success", cancelled: "warning", awaiting_reply: "warning", collected_unpaid: "warning", outsourced: "info", ready_notified: "success" };
export const custodyLabels = { unknown: "保管待核对", store: "设备已留下", customer: "设备未留下／已交还" };
export const repairStageGroups = { outsourced: "outsourced", diagnosis: "diagnosis", awaiting_quote: "awaiting_quote", awaiting_parts: "awaiting_parts", repairing: "processing", testing: "testing", ready: "ready", completed: "complete", cancelled: "cancelled" } as const;
const stageLabel = (status: RepairStatus) => repairStatusOptions.find(option => option.value === status)!.label;
// Legacy IDs remain readable; daily groups summarize the saved business facts.
export const workflowGroups = { rework: "返修", processing: "处理中", purchase: "等配件", ready: "等取机", awaiting_reply: "久等 未答复", collected_unpaid: "欠款 已拿走", outsourced: stageLabel("outsourced"), diagnosis: stageLabel("diagnosis"), awaiting_quote: stageLabel("awaiting_quote"), awaiting_parts: stageLabel("awaiting_parts"), testing: stageLabel("testing"), arrival: "到货", arrival_notified: "到货已通知", ready_notified: "修好已通知", complete: stageLabel("completed"), cancelled: stageLabel("cancelled") };
export type WorkflowGroup = keyof typeof workflowGroups;
export const retiredWorkflowGroups: WorkflowGroup[] = ["arrival_notified", "ready_notified", "awaiting_reply", "collected_unpaid", "arrival", "outsourced", "diagnosis", "awaiting_quote", "awaiting_parts", "testing", "complete", "cancelled"];
export function initialRepairWorkflow(order: RepairDirectoryEntry): RepairWorkflow { return { revision: 0, status: order.status, custody: order.custody ?? (order.id.startsWith("LOCAL-") ? "unknown" : "store"), notice: null, events: [], updatedAt: order.updatedAt }; }
export function isRepairReady(workflow: RepairWorkflow) { return ["ready", "ready_notified"].includes(workflow.status) || (["awaiting_reply", "collected_unpaid"].includes(workflow.status) && Boolean(workflow.readyCycle)); }
export function repairStageStatus(workflow: Pick<RepairWorkflow, "status" | "readyCycle">): keyof typeof repairStageGroups {
  if (workflow.status === "ready_notified") return "ready";
  if (workflow.status === "awaiting_reply" || workflow.status === "collected_unpaid") return workflow.readyCycle ? "ready" : "awaiting_quote";
  return workflow.status;
}
export function pickupNotice(workflow: RepairWorkflow) {
  if (!isRepairReady(workflow)) return "尚未修好";
  if (workflow.pickupNotice?.cycle === (workflow.readyCycle ?? "legacy") && workflow.pickupNotice.outcome === "notified") return "已通知取机";
  return workflow.status === "ready_notified" && !workflow.pickupNotice ? "已通知取机（旧记录）" : "未通知取机";
}
export function partsSignature(records: ProcurementRecord[], id: string, requirements: RepairRequirement[] = []) {
  const summary = repairPartsSummary(records, id, requirements);
  if (!summary.allRequiredReady || summary.total === 0) return "";
  return JSON.stringify([requirements.toSorted((a,b) => a.id.localeCompare(b.id)).map(row => [row.id, row.revision, row.mode, row.confirmed, row.sourceFingerprint, row.deviceFingerprint]), records.filter(row => row.repairId === id && row.required !== false).toSorted((a,b) => a.id.localeCompare(b.id)).map(row => [row.id, row.quantity, row.events.length, row.requirementId, row.requirementRevision])]);
}
export function arrivalNotice(workflow: RepairWorkflow, records: ProcurementRecord[], id: string, order: RequirementSource = {}) {
  if (workflow.custody === "store") return "无需到货通知";
  if (workflow.custody === "unknown") return "先核对设备保管";
  const requirements = currentRepairRequirements(order, workflow);
  const signature = partsSignature(records, id, requirements);
  if (!signature) return requirements.some(row => row.mode === "pending" || !row.confirmed) ? "需求待核对／配件未到齐" : "配件未到齐";
  // Prior no-requirement signatures remain valid without inventing new communication.
  const legacy = records.filter(row => row.repairId === id && row.required !== false).map(row => `${row.id}:${row.quantity}:${row.events.length}`).sort().join("|");
  return workflow.notice?.outcome === "notified" && (workflow.notice.signature === signature || (!requirements.length && workflow.notice.signature === legacy)) ? "已通知送机" : "未通知送机";
}
const activeRepairStages: RepairStatus[] = ["diagnosis", "awaiting_quote", "awaiting_parts", "repairing", "testing", "outsourced"];
const recoveryStageLabels = new Set(activeRepairStages.map(status => `维修阶段：${stageLabel(status)}`));
/** Only an explicit recovery into active handling opens a new cycle after handover. */
export function hasCurrentRepairHandover(workflow: RepairWorkflow): boolean {
  if (!workflow.handedOver) return false;
  const handoverIndex = workflow.events.findLastIndex(event => event.type === "followup" && event.time === workflow.handedOver!.time && event.label === "欠款已拿走：已记录");
  const stageIndex = workflow.events.findLastIndex(event => event.type === "stage" && recoveryStageLabels.has(event.label));
  if (handoverIndex >= 0) return stageIndex <= handoverIndex;
  return !workflow.events.some(event => event.type === "stage" && recoveryStageLabels.has(event.label) && event.time > workflow.handedOver!.time);
}
export function isRepairHistory(order: RepairDirectoryEntry, workflow?: RepairWorkflow): boolean {
  const current = workflow ?? initialRepairWorkflow(order);
  return ["completed", "cancelled"].includes(repairStageStatus(current)) || hasCurrentRepairHandover(current);
}
export function repairPendingParts(records: ProcurementRecord[], id: string): ProcurementRecord[] {
  return records.filter(row => row.repairId === id && row.required !== false && ["ordered", "partial"].includes(procurementStatus(row)));
}
export function workflowGroup(order: RepairDirectoryEntry, records: ProcurementRecord[], workflow?: RepairWorkflow): WorkflowGroup {
  const current = workflow ?? initialRepairWorkflow(order);
  if (repairStageStatus(current) === "cancelled") return "cancelled";
  if (isRepairHistory(order, current)) return "complete";
  if (isRepairReady(current)) return "ready";
  if (repairPendingParts(records, order.id).length) return "purchase";
  return order.repairOrigin ? "rework" : "processing";
}
export type RepairProgress = { label: string; tone: RepairTone; note: string };
export function repairProgress(order: RepairDirectoryEntry, records: ProcurementRecord[], workflow?: RepairWorkflow): RepairProgress {
  const current = workflow ?? initialRepairWorkflow(order);
  const stage = repairStageStatus(current);
  const group = workflowGroup(order, records, current);
  const requirements = currentRepairRequirements(order, current);
  const parts = repairPartsSummary(records, order.id, requirements);
  if (group === "cancelled") return { label: "作废", tone: "warning", note: current.custody === "store" ? "设备待交还" : "" };
  if (group === "complete") return { label: stage === "completed" ? "维修结束" : "已取机 · 待收尾", tone: "success", note: current.followUp?.collectedUnpaid ? "欠款待收尾" : !hasCurrentRepairHandover(current) && current.custody !== "customer" ? "交还待核对" : "" };
  if (group === "ready") return { label: pickupNotice(current).startsWith("已通知") ? "已通知" : "未通知", tone: "success", note: parts.unresolvedRequirements || parts.total > 0 && !parts.allRequiredReady ? "配件待核对" : "" };
  if (group === "purchase") {
    const arrived = records.some(row => row.repairId === order.id && row.required !== false && arrivedQuantity(row) > 0);
    return { label: arrived ? "部分到货" : "已下单", tone: "info", note: parts.unresolvedRequirements ? "需求待核对" : parts.ordered < parts.total ? "其余待下单" : "" };
  }
  if (["awaiting_quote", "repairing", "testing", "outsourced"].includes(stage)) return { label: stageLabel(stage), tone: repairStageTones[stage], note: parts.unresolvedRequirements && records.some(row => row.repairId === order.id) ? "需求待核对" : "" };
  if (parts.allRequiredReady && parts.total > 0) return { label: current.custody === "customer" ? "待送机" : "已到货", tone: "info", note: current.custody === "unknown" ? "保管待核对" : "" };
  if (parts.inCart > 0) return { label: "已加车", tone: "info", note: parts.unresolvedRequirements ? "需求待核对" : "" };
  return { label: stage === "awaiting_parts" ? "待选配件" : "待检测", tone: repairStageTones[stage], note: parts.ordered > 0 || parts.arrived > 0 ? "其余配件待核对" : "" };
}
/** A new purchase requires an explicitly active repair; arrival/correction facts stay appendable. */
export function assertRepairProcurementOpen(order: RepairDirectoryEntry, workflow?: RepairWorkflow): void {
  const current = workflow ?? initialRepairWorkflow(order);
  if (isRepairHistory(order, current) || isRepairReady(current)) throw new Error("请先明确恢复维修，再新增配件或下单。");
}
/** Actual procurement progress remains independent of the manually selected stage. */
export function repairPartsFollowup(order: RepairDirectoryEntry, records: ProcurementRecord[], workflow?: RepairWorkflow): "purchase" | "arrival" | null {
  const current = workflow ?? initialRepairWorkflow(order);
  if (isRepairHistory(order, current) || isRepairReady(current)) return null;
  const parts = repairPartsSummary(records, order.id, currentRepairRequirements(order, current));
  if (parts.allRequiredReady && parts.total > 0) return "arrival";
  return repairPendingParts(records, order.id).length ? "purchase" : null;
}
export function stageChangeNeedsNote(previous: RepairStatus, next: RepairStatus) { return ["cancelled", "collected_unpaid"].includes(next) || ["completed", "cancelled", "collected_unpaid"].includes(previous); }
export function applyWorkflowCommand(workflow: RepairWorkflow, command: WorkflowCommand, activity: Pick<RepairActivity, "id" | "time" | "actorId">, records: ProcurementRecord[], repairId: string, revision: number, order: RequirementSource = {}) {
  if (revision !== workflow.revision) throw new Error("工单已变化，请核对最新状态后重试。");
  if (!activity.id || workflow.events.some(event => event.id === activity.id) || workflow.events.length >= 1000) throw new Error("重复操作或历史已达上限，未保存。");
  if (!activity.time || activity.time < workflow.updatedAt) throw new Error("操作时间不能早于上次更新。");
  if (!command || !["stage", "custody", "arrival_notice", "pickup_notice", "requirement", "followup", "quote_contact"].includes(command.type)) throw new Error("不支持的维修操作。");
  const next = { ...workflow }; let label = ""; let note = "";
  const requirements = currentRepairRequirements(order, workflow);
  if (command.type === "requirement") {
    if (isRepairReady(workflow) || hasCurrentRepairHandover(workflow) || ["completed", "cancelled"].includes(repairStageStatus(workflow))) throw new Error("请先明确恢复维修，再新增或更改维修项目。 ");
    validateRepairRequirements([command.item]); if (typeof command.note !== "string") throw new Error("备注格式无效。"); note = command.note.trim(); if (note.length > 1200) throw new Error("备注最多1200字。");
    const item = command.item; const existing = requirements.find(row => row.id === item.id); const source = order.requirements?.find(row => row.id === item.id);
    if (order.deviceFingerprint && item.deviceFingerprint !== order.deviceFingerprint) throw new Error("设备型号已变化，请重新核对项目。 ");
    if (source && item.sourceFingerprint !== source.sourceFingerprint) throw new Error("接单要求已变化，请重新核对。");
    if (existing && item.revision !== existing.revision) throw new Error("项目要求已变化，请重新核对。");
    if (!existing && item.revision !== 1) throw new Error("新项目版本无效。");
    const linked = records.filter(row => row.repairId === repairId && row.requirementId === item.id);
    if (item.mode === "none" && linked.some(row => row.required !== false)) throw new Error("本项目仍有关联必需配件，不能标记无需采购。");
    if (item.mode === "none" && !note) throw new Error("请说明本项目为何无需采购。");
    if (item.mode === "parts" && item.confirmed && (!linked.length || linked.some(row => row.required !== false && row.requirementRevision !== existing?.revision))) throw new Error("请先登记本项目配件，并核对全部必需条目的要求版本。");
    // Scope changes invalidate references; confirming completeness alone preserves their revision.
    const sameScope = existing && existing.title === item.title && existing.request === item.request && existing.mode === item.mode && existing.sourceFingerprint === source?.sourceFingerprint && existing.deviceFingerprint === order.deviceFingerprint;
    const saved = { ...item, deviceFingerprint: order.deviceFingerprint, title: source?.title ?? item.title.trim(), request: source?.request ?? item.request.trim(), revision: existing ? existing.revision + (sameScope ? 0 : 1) : 1, ...(source ? { sourceFingerprint: source.sourceFingerprint } : { sourceFingerprint: undefined }) };
    next.requirements = [...requirements.filter(row => row.id !== item.id), saved]; validateRepairRequirements(next.requirements);
    label = `${saved.title}：${saved.mode === "none" ? "无需采购" : saved.confirmed ? "本项目配件已登记" : "待核对／选件"}`;
  } else if (command.type === "quote_contact") {
    if (["completed", "cancelled"].includes(repairStageStatus(workflow)) || hasCurrentRepairHandover(workflow)) throw new Error("历史工单只能查看报价沟通记录，请先明确恢复维修。");
    if (!Object.hasOwn(quoteContactLabels, command.outcome)) throw new Error("请选择实际报价沟通结果。");
    if (typeof command.note !== "string" || !command.note.trim() || command.note.trim().length > 1200) throw new Error("请填写报价沟通说明，最多1200字。");
    note = command.note.trim();
    next.quoteContact = { outcome: command.outcome, time: activity.time, note, ...(activity.actorId ? { actorId: activity.actorId } : {}) };
    label = quoteContactLabels[command.outcome];
  } else if (command.type === "stage") {
    if (!repairStatusOptions.some(option => option.value === command.status)) throw new Error("请选择有效维修阶段。");
    if (typeof command.note !== "string") throw new Error("备注格式无效。"); note = command.note.trim(); if (note.length > 1200) throw new Error("备注最多1200字。");
    if (command.status === workflow.status) throw new Error("维修阶段没有变化。");
    const handedOver = hasCurrentRepairHandover(workflow);
    if (handedOver && ["ready", "ready_notified", "awaiting_reply"].includes(command.status)) throw new Error("设备已取走，请先明确恢复维修，再核对修好及取机通知。");
    if (handedOver && activeRepairStages.includes(command.status) && !note) throw new Error("恢复维修需要填写原因。");
    if (command.status === "ready" && !isRepairReady(workflow)) {
      const parts = repairPartsSummary(records, repairId, requirements);
      if (parts.unresolvedRequirements || parts.total > 0 && !parts.allRequiredReady) throw new Error("必需配件未到齐或维修项目待核对，请先核对再设为等取机。");
    }
    if (stageChangeNeedsNote(workflow.status, command.status) && !note) throw new Error("作废、欠款取走或恢复工单需要填写原因。");
    if (command.status === "collected_unpaid") throw new Error("请在修好跟进中核对实际交还及欠款，不用阶段标记代替交还事实。");
    if (command.status === "ready_notified") {
      if (!isRepairReady(workflow)) throw new Error("请先核对工单已修好，再记录实际通知。");
      next.status = "ready"; next.pickupNotice = { cycle: workflow.readyCycle ?? "legacy", outcome: "notified" };
    } else if (command.status === "awaiting_reply" && isRepairReady(workflow)) {
      next.status = "ready"; next.followUp = { collectedUnpaid: false, ...workflow.followUp, awaitingReply: true };
      if (workflow.status === "ready_notified" && !workflow.pickupNotice) next.pickupNotice = { cycle: workflow.readyCycle ?? "legacy", outcome: "notified" };
    } else {
      if (command.status === "ready" && workflow.status === "ready_notified" && !workflow.pickupNotice) next.pickupNotice = { cycle: workflow.readyCycle ?? "legacy", outcome: "notified" };
      next.status = command.status;
      if (!["ready", "ready_notified"].includes(command.status)) { next.readyCycle = undefined; next.pickupNotice = undefined; }
      if (command.status === "ready" && !isRepairReady(workflow)) { next.readyCycle = activity.id; next.pickupNotice = undefined; next.followUp = { awaitingReply: false, collectedUnpaid: workflow.followUp?.collectedUnpaid ?? false }; }
    }
    label = `维修阶段：${repairStatusOptions.find(option => option.value === command.status)!.label}`;
  } else if (command.type === "custody") {
    if (!Object.hasOwn(custodyLabels, command.custody) || command.custody === workflow.custody) throw new Error("请核对设备实际保管情况。");
    next.custody = command.custody; label = custodyLabels[command.custody];
  } else if (command.type === "followup") {
    if (!isRepairReady(workflow) && !(command.value === false && workflow.followUp?.[command.flag])) throw new Error("请先核对工单已修好；旧跟进状态不能推断修好。");
    if (command.value && hasCurrentRepairHandover(workflow)) throw new Error("设备已取走，只能结束既有跟进或明确恢复维修。");
    if (!["awaitingReply", "collectedUnpaid"].includes(command.flag) || typeof command.value !== "boolean") throw new Error("跟进状态无效。");
    if (typeof command.note !== "string") throw new Error("备注格式无效。"); note = command.note.trim(); if (note.length > 1200) throw new Error("备注最多1200字。"); if (!note) throw new Error("请填写跟进说明。");
    if (command.flag === "collectedUnpaid" && command.value) {
      if (command.delivered !== true || command.unpaid !== true) throw new Error("请明确核对设备实际交还和未结清事实。");
      next.custody = "customer"; next.handedOver = { time: activity.time, actorId: activity.actorId, unpaid: true };
    }
    next.followUp = { awaitingReply: false, collectedUnpaid: false, ...workflow.followUp, [command.flag]: command.value };
    label = `${command.flag === "awaitingReply" ? "久等未答复" : "欠款已拿走"}：${command.value ? "已记录" : "已结束跟进"}`;
  } else {
    if (!["notified", "unreachable"].includes(command.outcome)) throw new Error("请选择实际沟通结果。");
    if (typeof command.note !== "string") throw new Error("备注格式无效。"); note = command.note.trim(); if (note.length > 1200) throw new Error("备注最多1200字。");
    if (hasCurrentRepairHandover(workflow) || ["completed", "cancelled"].includes(repairStageStatus(workflow))) throw new Error("历史工单不能新增到货或取机通知，请先明确恢复维修。");
    if (command.type === "arrival_notice") {
      const signature = partsSignature(records, repairId, requirements);
      if (workflow.custody !== "customer" || !signature) throw new Error("仅设备未留下且需求已核对、必需配件到齐时记录到货通知。");
      next.notice = { signature, outcome: command.outcome }; label = command.outcome === "notified" ? "已成功通知送机" : "到货联系未接通";
    } else {
      if (!isRepairReady(workflow)) throw new Error("请先核对工单已修好。");
      next.pickupNotice = { cycle: workflow.readyCycle ?? "legacy", outcome: command.outcome }; label = command.outcome === "notified" ? "已成功通知取机" : "取机联系未接通";
    }
  }
  return { ...next, revision: workflow.revision + 1, updatedAt: activity.time, events: [...workflow.events, { ...activity, type: command.type, label, note }] };
}
export function overlayRepair(order: RepairDirectoryEntry, workflow?: RepairWorkflow): RepairDirectoryEntry { const current = workflow ?? initialRepairWorkflow(order); const stage = repairStageStatus(current); return { ...order, status: current.status, statusLabel: stageLabel(stage), tone: repairStageTones[stage], updatedAt: current.updatedAt > order.updatedAt ? current.updatedAt : order.updatedAt }; }

/** Reject malformed optional additions before a local JSON envelope reaches UI selectors. */
export function validateWorkflowExtensions(value: RepairWorkflow) {
  if (value.quoteContact !== undefined && (!value.quoteContact || typeof value.quoteContact.outcome !== "string" || !Object.hasOwn(quoteContactLabels, value.quoteContact.outcome) || typeof value.quoteContact.time !== "string" || !value.quoteContact.time || typeof value.quoteContact.note !== "string" || !value.quoteContact.note.trim() || value.quoteContact.note.length > 1200 || (value.quoteContact.actorId !== undefined && (typeof value.quoteContact.actorId !== "string" || !value.quoteContact.actorId || value.quoteContact.actorId.length > 100)))) throw new Error("报价沟通资料无效。");
  if (value.requirements !== undefined) validateRepairRequirements(value.requirements);
  if (value.readyCycle !== undefined && (typeof value.readyCycle !== "string" || !value.readyCycle || value.readyCycle.length > 100)) throw new Error("修好周期资料无效。");
  if (value.pickupNotice !== undefined && (!value.pickupNotice || typeof value.pickupNotice.cycle !== "string" || !value.pickupNotice.cycle || !["notified", "unreachable"].includes(value.pickupNotice.outcome))) throw new Error("取机通知资料无效。");
  if (value.followUp !== undefined && (!value.followUp || typeof value.followUp.awaitingReply !== "boolean" || typeof value.followUp.collectedUnpaid !== "boolean")) throw new Error("跟进资料无效。");
  if (value.handedOver !== undefined && (!value.handedOver || typeof value.handedOver.time !== "string" || !value.handedOver.time || typeof value.handedOver.unpaid !== "boolean" || (value.handedOver.actorId !== undefined && typeof value.handedOver.actorId !== "string"))) throw new Error("实际交还资料无效。");
}
