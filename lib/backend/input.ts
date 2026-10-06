import { BackendError } from "./database";

export function fields(value:unknown,allowed:readonly string[]) {
  if(!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).some(key=>!allowed.includes(key))) throw new BackendError("请求包含无效或不支持的字段。");
}
export const intakeFields=["itemQuotes","itemQuoteHistory","revision","policy","faults","issueNote","retailOrigin","repairOrigin","custody","id","createdAt","updatedAt","previewAt","customerName","phone","email","category","brand","model","color","serial","issue","accessories","services","priority","photoCount","photos"];
export const procurementFields=["id","repairId","item","supplier","quantity","unitCostCents","expectedAt","reference","events","required","supplierId","requirementId","requirementRevision","specification"];
export const workflowCommandFields:Record<string,string[]>={
  stage:["status","note"],custody:["custody"],arrival_notice:["outcome","note"],pickup_notice:["outcome","note"],quote_contact:["outcome","note"],
  requirement:["item","note"],followup:["flag","value","note","delivered","unpaid"],
};
export const customerFields=["phone","name","email","note","updatedAt"];
export const settingsFields=["repairGroups","revision","shopName","address","phone","paper","repairWarrantyMonths","retailWarrantyMonths","suppliers","finance"];
export const memberFields=["id","name","email","role","accountStatus","membershipStatus","permissions","revision"];
export const retailFields=["id","code","category","brand","model","serial","imei1","imei2","productCode","color","ramGb","bodyStorage","disks","cpu","gpu","keyboard","edition","controllers","condition","warrantyMonths","grade","batteryPercent","accessories","knownIssues","photos","costCents","refurbCents","priceCents","source","location","intakeDate","storeOwned","status","version","inspection","reservation","sales","events","currentSaleId"];
export const commandFields:Record<string,string[]>={
  edit:["change"],inspect:["checks","note"],price:["priceCents"],approve:["note"],pause:["note"],reinspect:["note"],
  sell:["saleId","customerPhone","customerName","customerEmail","customerAddress","customerNote","priceCents","warranty","paymentUnreceived"],
  reserve:["name","phone","until","note"],release_reservation:[],
  payment:["saleId","entryId","amountCents","date","method","note"],refund:["saleId","entryId","amountCents","date","method","note"],
  payment_reconcile:["saleId","paidCents","reason"],payment_void:["saleId","entryId","reason"],refund_void:["saleId","entryId","reason"],
  deliver:["saleId","deliveryDate","debt"],return:["saleId","date","reason","received"],
  after_sale:["saleId","caseId","date","issue","custody"],after_sale_assess:["saleId","caseId","coverage","reason"],
  after_sale_link:["saleId","caseId","repairId"],after_sale_close:["saleId","caseId","date","resolution","returned"],after_sale_cancel:["saleId","caseId","reason"],photos:["photos"]
};
