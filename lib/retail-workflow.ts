import { applyRetailCommand, createRetailUnit, validateRetailPhotos, retailWarrantyTermsVersion, type Inspection, type RetailCommand, type RetailDebtDelivery, type RetailEvent, type RetailPaymentMethod, type RetailUnit, type RetailWarrantySnapshot } from "./retail";
import type { StoreSettings } from "./store-settings";
import type { Permission } from "./staff";

export interface RetailCreateReadyWorkflow { type: "create_ready"; unit: RetailUnit; photos?: string[]; checks: Inspection; note?: string; settingsRevision: number }
export interface RetailInspectApproveWorkflow { type: "inspect_approve"; id: string; version: number; checks: Inspection; priceCents?: number; note?: string }
export interface RetailWorkflowSale { customerPhone: string; customerName: string; customerEmail?: string; customerAddress?: string; customerNote?: string; priceCents: number; warranty: RetailWarrantySnapshot }
export interface RetailWorkflowPayment { amountCents: number; date: string; method: RetailPaymentMethod; note?: string }
export interface RetailWorkflowDelivery { deliveryDate: string; debt?: RetailDebtDelivery }
export interface RetailCheckoutWorkflow { type: "checkout"; id: string; version: number; settingsRevision: number; sale: RetailWorkflowSale; payments: RetailWorkflowPayment[]; paymentUnreceived?: boolean; delivery?: RetailWorkflowDelivery }
export type RetailWorkflow = RetailCreateReadyWorkflow | RetailInspectApproveWorkflow | RetailCheckoutWorkflow;

function keys(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error("请求包含无效或不支持的字段。");
}
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error("请核对记录版本。"); return Number(value); }
export function retailInspectionDetail(checks: Inspection, note?: string): string {
  if (!checks || typeof checks !== "object" || Array.isArray(checks) || Object.keys(checks).sort().join(",") !== "data,functional,ownership" || !Object.values(checks).every(value => typeof value === "boolean")) throw new Error("三项检测须明确核对。");
  if (note !== undefined && (typeof note !== "string" || note.length > 5000)) throw new Error("检测说明或状态变更原因无效。");
  if (note?.trim()) return note;
  return `功能检测：${checks.functional ? "已核对" : "未完成"}；所有权及账号锁核验：${checks.ownership ? "已核对" : "未完成"}；数据处理核验：${checks.data ? "已核对" : "未完成"}。`;
}
export function validateRetailWorkflow(value: unknown): asserts value is RetailWorkflow {
  keys(value, ["type", "unit", "photos", "checks", "note", "settingsRevision", "id", "version", "priceCents", "sale", "payments", "paymentUnreceived", "delivery"]);
  if (value.type === "create_ready") keys(value,["type","unit","photos","checks","note","settingsRevision"]);
  else if (value.type === "inspect_approve") keys(value,["type","id","version","checks","priceCents","note"]);
  else if (value.type === "checkout") {
    keys(value,["type","id","version","settingsRevision","sale","payments","paymentUnreceived","delivery"]);
    keys(value.sale,["customerPhone","customerName","customerEmail","customerAddress","customerNote","priceCents","warranty"]);
    if (!Array.isArray(value.payments) || value.payments.length > 100) throw new Error("请核对实际收款记录。");
    for (const payment of value.payments) keys(payment,["amountCents","date","method","note"]);
    if (value.paymentUnreceived !== undefined && typeof value.paymentUnreceived !== "boolean") throw new Error("尚未收款须明确核对。");
    if (value.payments.length ? value.paymentUnreceived === true : value.paymentUnreceived !== true) throw new Error("请核对实际收款或明确尚未收款。");
    if (value.delivery !== undefined) keys(value.delivery,["deliveryDate","debt"]);
  } else throw new Error("未知单机操作。");
}
export function retailWorkflowPermissions(command: RetailWorkflow): Permission[] {
  validateRetailWorkflow(command);
  const permissions: Permission[] = ["retail.view"];
  if (command.type === "create_ready") {
    permissions.push("retail.edit","retail.inspect");
    if (command.unit.costCents !== null || command.unit.refurbCents !== null) permissions.push("financial.edit");
    if (command.unit.priceCents !== null) permissions.push("retail.price");
  } else if (command.type === "inspect_approve") {
    permissions.push("retail.inspect"); if (command.priceCents !== undefined) permissions.push("retail.price");
  } else {
    permissions.push("retail.sell"); if (command.payments.length) permissions.push("sale.payment");
    if (command.delivery) { permissions.push("sale.deliver"); if (command.delivery.debt) permissions.push("sale.debt"); }
  }
  return permissions;
}
/** Compose checked facts in memory; the write boundary persists the final unit once. */
export function applyRetailWorkflow(command: RetailWorkflow, existing: RetailUnit[], event: RetailEvent, settings: StoreSettings): RetailUnit {
  validateRetailWorkflow(command);
  if (typeof event.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.id)) throw new Error("请求标识无效。");
  let next: RetailUnit;
  const step = (suffix: string, type: RetailCommand, detail: string) => {
    next = applyRetailCommand(next,type,{...event,id:`${event.id}:${suffix}`,title:`单机操作：${type.type}`,detail},next.version,existing);
  };
  if (command.type === "create_ready") {
    if (settings.revision !== revision(command.settingsRevision)) throw new Error("销售保修约定已变化，请重新核对。");
    next = createRetailUnit(command.unit,existing,{...event,id:`${event.id}:create`,title:"独立单机档案已建立",detail:"门店自有实物，待检测。"});
    if (command.photos !== undefined) step("photos",{type:"photos",photos:validateRetailPhotos(command.photos)},"本次实物照片已保存。");
  } else {
    const current = existing.find(unit => unit.id === command.id);
    if (!current) throw new Error("单机不存在。");
    if (current.version !== revision(command.version)) throw new Error("单机已变化，请重新核对。");
    next = current;
  }
  if (command.type !== "checkout") {
    if (command.type === "inspect_approve" && command.priceCents !== undefined) {
      if (next.priceCents !== null && next.priceCents > 0) throw new Error("已有有效售价，请通过售价更正核对。");
      step("price",{type:"price",priceCents:command.priceCents},"本次有效售价已核对。");
    }
    step("inspect",{type:"inspect",checks:command.checks,note:command.note},retailInspectionDetail(command.checks,command.note));
    step("approve",{type:"approve"},"本台三项检查完成，已明确设为可售。");
    return next;
  }
  if (settings.revision !== revision(command.settingsRevision)) throw new Error("销售保修约定已变化，请重新核对。");
  const warranty: RetailWarrantySnapshot = {months:next.warrantyMonths,termsVersion:retailWarrantyTermsVersion,shopName:settings.shopName,address:settings.address,phone:settings.phone};
  if (JSON.stringify(command.sale.warranty) !== JSON.stringify(warranty)) throw new Error("销售保修约定已变化，请重新核对。");
  const saleId = `${event.id}:sale`;
  if (existing.some(unit => unit.sales.some(sale => sale.id === saleId))) throw new Error("操作标识已用于不同资料，请重新核对。");
  step("sale",{type:"sell",...command.sale,warranty,saleId,paymentUnreceived:command.payments.length === 0},"本次买家与成交约定已核对；交付另据实际事实登记。");
  if (command.payments.length) {
    // Zero is only this new transaction's opening, never a claim about an old sale.
    next = {...next,sales:next.sales.map(sale => sale.id === saleId ? {...sale,paidCents:0,paymentOpeningCents:0,paymentUnreceived:false,note:"本次实际收款逐笔登记；交付另据实际事实确认。"} : sale)};
  }
  command.payments.forEach((payment,index) => step(`payment:${index}`,{type:"payment",saleId,entryId:`${event.id}:payment:${index}`,...payment,note:payment.note ?? ""},"本次实际收款已登记。"));
  if (command.delivery) step("delivery",{type:"deliver",saleId,...command.delivery},"本次实际交付已登记。");
  return next;
}
