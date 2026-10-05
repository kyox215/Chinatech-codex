import { can, type Permission, type StaffMember } from "./staff";
import { currentRetailSale, isRetailDate, type RetailCommand, type RetailEditableField, type RetailUnit } from "./retail";
import type { IntakeReceiptData } from "./repair-intake-record";
import type { RepairActivity } from "./repair-workflow";

// Exhaustive against the repair domain: valid contact and follow-up facts do not invalidate completion.
const repairActivityTypes: Record<RepairActivity["type"], true> = { stage: true, custody: true, arrival_notice: true, pickup_notice: true, requirement: true, followup: true, quote_contact: true };
export function retailFieldPermission(field: RetailEditableField): Permission {return field === "costCents" || field === "refurbCents" ? "financial.edit" : field === "priceCents" ? "retail.price" : "retail.edit";}
export function retailCommandPermission(command: RetailCommand): Permission {
  if (command.type === "edit") return command.change.field === "costCents" || command.change.field === "refurbCents" ? "financial.edit" : command.change.field === "priceCents" ? "retail.price" : "retail.edit";
  if (command.type === "price") return "retail.price";
  if (["sell","reserve","release_reservation"].includes(command.type)) return "retail.sell";
  if (command.type === "deliver") return "sale.deliver";
  if (command.type === "payment") return "sale.payment";
  if (["payment_reconcile","payment_void"].includes(command.type)) return "sale.reconcile";
  if (["return","refund","refund_void"].includes(command.type)) return "sale.refund";
  if (command.type.startsWith("after_sale")) return "sale.aftersales";
  if (command.type === "photos") return "retail.edit";
  return "retail.inspect";
}
// M1 presentation projection. Raw localStorage/fixtures are not a security boundary.
export function projectRetailForStaff(units: RetailUnit[], member: StaffMember | null): RetailUnit[] {
  if (!can(member,"retail.view")) return [];
  if (can(member,"financial.read")) return units;
  return units.map(unit=>({...unit,costCents:null,refurbCents:null,sales:unit.sales.map(sale=>{
    const projected = { ...sale }; delete projected.costCents; delete projected.refurbCents; return projected;
  }),events:unit.events.map(event=>event.sensitive === "financial" || /成本|毛利|利润|costCents|refurbCents|grossProfit/i.test(event.title + " " + event.detail) ? {...event,title:"财务资料更正",detail:"仅财务授权账号可查看。"} : event)}));
}

// The domain owns sale facts; this write-boundary check requires the actual local repair.
export function requireRetailAfterSaleRepair(unit: RetailUnit, command: Extract<RetailCommand, { type: "after_sale_link" | "after_sale_close" }>, records: IntakeReceiptData[], workflowRaw: string | null): void {
  const sale = unit.sales.find(value => value.id === command.saleId);
  const request = sale?.afterSales?.find(value => value.id === command.caseId);
  const repairId = command.type === "after_sale_link" ? command.repairId : request?.repairId;
  const matches = records.filter(value => value.retailOrigin?.unitId === unit.id && value.retailOrigin.saleId === command.saleId && value.retailOrigin.caseId === command.caseId);
  const repair = matches[0];
  if (!sale || !request || matches.length !== 1 || repair.id !== repairId) throw new Error("关联工单不存在或售后来源不一致。");
  if (command.type === "after_sale_link") {
    if (!request.repairId && (currentRetailSale(unit)?.id !== sale.id || sale.returned || unit.status !== "sold")) throw new Error("只能为当前未退回销售建立维修；原售后历史保留。");
    return;
  }
  let saved;
  try { saved = workflowRaw === null ? null : JSON.parse(workflowRaw); }
  catch { throw new Error("关联维修状态无法读取，售后未关闭。"); }
  const workflow = saved?.version === 1 && saved.workflows && typeof saved.workflows === "object" && !Array.isArray(saved.workflows) ? saved.workflows[repair.id] : null;
  const time = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) && isRetailDate(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60;
  if (!workflow || workflow.status !== "completed" || !["unknown", "store", "customer"].includes(workflow.custody)
    || !Array.isArray(workflow.events) || !workflow.events.length || !Number.isSafeInteger(workflow.revision) || workflow.revision !== workflow.events.length || !time(workflow.updatedAt)
    || workflow.notice !== null && (!workflow.notice || typeof workflow.notice.signature !== "string" || !["notified", "unreachable"].includes(workflow.notice.outcome))) throw new Error("请先在关联工单登记维修结束，再确认售后交还。");
  const events = workflow.events as { id: string; time: string; type: string; label: string; note: string }[];
  if (events.some((entry, index) => !entry || typeof entry.id !== "string" || !entry.id.trim() || !time(entry.time) || typeof entry.type !== "string" || !Object.hasOwn(repairActivityTypes, entry.type) || typeof entry.label !== "string" || typeof entry.note !== "string" || entry.time < repair.createdAt || index > 0 && entry.time < events[index - 1].time)
    || new Set(events.map(entry => entry.id)).size !== events.length || workflow.updatedAt !== events.at(-1)!.time) throw new Error("关联维修完成历史异常，售后未关闭。");
  const completion = events.findLast(entry => entry.type === "stage");
  if (!completion || completion.label !== "维修阶段：维修结束" || command.date < completion.time.slice(0, 10)) throw new Error("须核对实际维修结束日，售后交还日期不能早于维修结束。");
}
