import type { RepairRequirement } from "./repair-requirements";
export type ProcurementEvent = {
  id: string;
  type: "cart_added" | "cart_removed" | "ordered" | "arrival" | "correction" | "details_changed" | "requirement_linked";
  time: string;
  note: string;
  quantity: number;
  arrivalId?: string;
  reference?: string;
  actorId?: string;
  batchId?: string;
};

export type ProcurementRecord = {
  id: string;
  repairId: string;
  item: string;
  supplier: string;
  quantity: number;
  unitCostCents: number | null;
  expectedAt: string;
  reference: string;
  events: ProcurementEvent[];
  required?: boolean;
  supplierId?: string;
  requirementId?: string;
  requirementRevision?: number;
  specification?: string;
};

export type ProcurementStatus = "draft" | "cart" | "ordered" | "partial" | "complete";
export const procurementStatuses: Record<ProcurementStatus, { label: string; tone: string }> = {
  draft: { label: "待选配件 · 未下单", tone: "warning" },
  cart: { label: "已加购物车 · 未下单", tone: "info" },
  ordered: { label: "已下单 · 待到货", tone: "progress" },
  partial: { label: "部分到货", tone: "progress" },
  complete: { label: "已到齐", tone: "success" },
};

export function arrivedQuantity(record: ProcurementRecord) {
  return record.events.reduce((sum, event) => sum + (["arrival", "correction"].includes(event.type) ? event.quantity : 0), 0);
}

export function arrivalBalance(record: ProcurementRecord, arrivalId: string) {
  return record.events.reduce((sum, event) => sum + (event.id === arrivalId || event.arrivalId === arrivalId ? event.quantity : 0), 0);
}

export function procurementStatus(record: ProcurementRecord): ProcurementStatus {
  if (!record.events.some((event) => event.type === "ordered")) {
    const cartEvent = record.events.findLast((event) => event.type === "cart_added" || event.type === "cart_removed");
    return cartEvent?.type === "cart_added" ? "cart" : "draft";
  }
  const arrived = arrivedQuantity(record);
  return arrived === record.quantity ? "complete" : arrived > 0 ? "partial" : "ordered";
}

export function isPreorder(record: ProcurementRecord) {
  return ["draft", "cart"].includes(procurementStatus(record));
}

export const repairPartsGroups = {
  unrecorded: "配件待核对",
  draft: "待选配件",
  cart: "已加购物车 · 未下单",
  mixed: "部分已下单",
  ordered: "已下单",
  complete: "已登记配件到齐",
} as const;
export type RepairPartsGroup = keyof typeof repairPartsGroups;

export function repairPartsSummary(records: ProcurementRecord[], repairId: string, requirements: RepairRequirement[] = []) {
  const rows = records.filter((row) => row.repairId === repairId && row.required !== false);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const ordered = rows.reduce((sum, row) => sum + (isPreorder(row) ? 0 : row.quantity), 0);
  const arrived = rows.reduce((sum, row) => sum + arrivedQuantity(row), 0);
  const inCart = rows.reduce((sum, row) => sum + (procurementStatus(row) === "cart" ? row.quantity : 0), 0);
  const unresolvedRequirements = requirements.filter(requirement => requirement.mode === "pending" || !requirement.confirmed || (requirement.mode === "parts" && (!records.some(row => row.repairId === repairId && row.requirementId === requirement.id && row.requirementRevision === requirement.revision) || rows.some(row => row.requirementId === requirement.id && row.requirementRevision !== requirement.revision)))).length;
  const allRequiredReady = unresolvedRequirements === 0 && (rows.length > 0 || requirements.length > 0) && arrived === total;
  const group: RepairPartsGroup = unresolvedRequirements > 0 ? (ordered > 0 ? "mixed" : "draft") : !rows.length ? "unrecorded" : arrived === total ? "complete" : ordered === total ? "ordered" : ordered > 0 ? "mixed" : inCart === total ? "cart" : "draft";
  return { group, label: repairPartsGroups[group], total, ordered, arrived, inCart, unresolvedRequirements, allRequiredReady };
}

export function procurementEventLabel(event: ProcurementEvent) {
  if (event.type === "requirement_linked") return "已核对维修项目关联";
  if (event.type === "details_changed") return "配件资料已更新";
  if (event.type === "cart_added") return "已加购物车，尚未下单";
  if (event.type === "cart_removed") return "已取消加车标记，返回待选配件";
  if (event.type === "ordered") return "已标记实际下单";
  if (event.type === "arrival") return `分批到货 +${event.quantity} 件`;
  return `数量更正 ${event.quantity > 0 ? "+" : ""}${event.quantity} 件`;
}

// Preview-only ledger. Production writes still require server authorization and transactions.
export function appendProcurementEvent(record: ProcurementRecord, event: ProcurementEvent, expectedRevision = record.events.length): ProcurementRecord {
  if (record.events.length >= 1000) throw new Error("配件历史已达上限，请联系管理员核对。");
  if (expectedRevision !== record.events.length) throw new Error("记录已变化，请核对最新数量后再提交。");
  if (!event.id.trim() || record.events.some((existing) => existing.id === event.id)) throw new Error("重复操作未追加，请核对历史记录。");
  if (typeof event.note !== "string" || event.note.length > 1200 || [event.actorId, event.batchId].some(value => value !== undefined && (typeof value !== "string" || !value || value.length > 100))) throw new Error("采购历史资料无效。");
  if (!event.time.trim()) throw new Error("请记录操作时间。");
  if (!Number.isSafeInteger(event.quantity)) throw new Error("数量必须是整数。");
  if (!["cart_added", "cart_removed", "ordered", "arrival", "correction", "details_changed", "requirement_linked"].includes(event.type)) throw new Error("不支持的采购操作。");
  const status = procurementStatus(record);
  if (event.type === "requirement_linked") {
    if (event.quantity !== 0 || !event.note.trim()) throw new Error("关联核对需填写说明，不能改变数量。");
  } else if (event.type === "details_changed") {
    if (!isPreorder(record) || event.quantity !== 0 || !event.note.trim()) throw new Error("只能更新未下单配件，且必须保留变更记录。");
  } else if (event.type === "cart_added" || event.type === "cart_removed") {
    if (!isPreorder(record)) throw new Error("实际下单后不能用购物车操作撤销订单。");
    if (event.quantity !== 0) throw new Error("购物车记录不能改变到货数量。");
    if (event.type === "cart_added" && status === "cart") throw new Error("本配件已标记加车，不需要重复记录。");
    if (event.type === "cart_removed" && status !== "cart") throw new Error("只有已加车配件可以取消加车标记。");
  } else if (event.type === "ordered") {
    if (!isPreorder(record)) throw new Error("本条采购已下单，不能重复记录。");
    if (event.quantity !== 0) throw new Error("下单记录不能改变到货数量。");
    if ((event.reference ?? record.reference).trim().length > 100) throw new Error("供应商订单号最多 100 个字符。");
  } else {
    if (isPreorder(record)) throw new Error("先记录已下单，再登记到货。");
    if (event.type === "arrival") {
      if (event.quantity <= 0) throw new Error("本次到货数量必须大于零。");
    } else {
      if (!event.note.trim()) throw new Error("更正必须填写原因，原到货记录会保留。");
      if (event.quantity === 0) throw new Error("更正数量不能为零。");
      if (!record.events.some((previous) => previous.id === event.arrivalId && previous.type === "arrival")) throw new Error("请选择本条采购的原到货批次。");
      if (arrivalBalance(record, event.arrivalId!) + event.quantity < 0) throw new Error("更正后该批次数量不能小于零。");
    }
    const next = arrivedQuantity(record) + event.quantity;
    if (!Number.isSafeInteger(next) || next < 0 || next > record.quantity) throw new Error("到货合计不能小于零或超过采购数量。");
  }
  const reference = event.type === "ordered" ? (event.reference ?? record.reference).trim() : record.reference;
  return { ...record, reference, events: [...record.events, { ...event, note: event.note.trim(), ...(event.type === "ordered" ? { reference } : {}) }] };
}

export function validateProcurementDraft(record: ProcurementRecord) {
  if (!record.id.trim() || !record.repairId.trim() || !record.item.trim() || !record.supplier.trim()) throw new Error("请填写关联工单、配件名称和供应商。");
  if (!Number.isSafeInteger(record.quantity) || record.quantity < 1 || record.quantity > 10000) throw new Error("采购数量须为 1–10000 的整数。");
  if (record.unitCostCents !== null && (!Number.isSafeInteger(record.unitCostCents) || record.unitCostCents < 0 || record.unitCostCents > 100000000)) throw new Error("单价须为有效的非负金额，最多两位小数。");
  if (record.events.length) throw new Error("新采购必须从草稿开始。");
  if (record.supplierId !== undefined && (typeof record.supplierId !== "string" || !record.supplierId || record.supplierId.length > 100)) throw new Error("供应商标识无效。");
  if (record.specification !== undefined && (typeof record.specification !== "string" || record.specification.length > 1200)) throw new Error("配件规格最多1200字。");
  if ((record.requirementId === undefined) !== (record.requirementRevision === undefined) || (record.requirementId !== undefined && (typeof record.requirementId !== "string" || !record.requirementId || record.requirementId.length > 100 || !Number.isSafeInteger(record.requirementRevision) || record.requirementRevision! < 1))) throw new Error("维修项目关联无效。");
  return record;
}

export function formatCost(cents: number | null) {
  return cents === null ? "待确认" : `€${(cents / 100).toFixed(2)}`;
}
