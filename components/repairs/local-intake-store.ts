"use client";
import { useBackendState, useBackendMode } from "@/lib/backend/react";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { currentRetailSale, parseStoredRetailUnits, saleProductUnit, retailCategories } from "@/lib/retail";
import { retailUnits } from "@/lib/retail-fixtures";
import { emptyIntakeServices } from "@/lib/intake-services";
import { parseStoreSettings } from "@/lib/store-settings";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { intakeRecordTime } from "@/lib/repair-intake-record";
import { requirePreviewPermission } from "@/lib/staff-client";
import type { Permission } from "@/lib/staff";
import { useMemo, useSyncExternalStore } from "react";
import { repairOrders } from "@/lib/repair-fixtures";
import { intakeDirectoryEntry, parseLocalIntakes, validLocalIntake, parseIntakeSignatures, appendIntakeSignature, fixtureIntakeReceipt, type IntakeSignature, type IntakeSignatureDraft, type IntakePolicy, type IntakeReceiptData, type IntakePhotoAttachment } from "@/lib/repair-intake-record";
import { overlayRepair } from "@/lib/repair-workflow";
import { useRepairWorkflows } from "./repair-workflow-store";

const fixtureDirectory = repairOrders.map(order => { const source = intakeDirectoryEntry(fixtureIntakeReceipt(order)); return { ...order, requirements: source.requirements, deviceFingerprint: source.deviceFingerprint, intakeRevision: source.intakeRevision }; });
const key = "chinatech.m1.local-intakes.v1";
const change = "chinatech-local-intake-change";
const server = { records: [] as IntakeReceiptData[], signatures: [] as IntakeSignature[], ready: false, error: "" };
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=server;
let cachedRaw: string | null | undefined;
let snapshot = server;
function read() {if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;remoteSnapshot={records:current?.intakes??[],signatures:current?.signatures??[],ready:true,error:current?"":"后台资料暂不可用。"};}return remoteSnapshot;}
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== cachedRaw || !snapshot.ready) {
      cachedRaw = raw;
      try { snapshot = { records: parseLocalIntakes(raw), signatures: parseIntakeSignatures(raw), ready: true, error: "" }; }
      catch { snapshot = { records: [], signatures: [], ready: true, error: "本地工单记录无法读取，现有记录未被覆盖。" }; }
    }
  } catch { cachedRaw = undefined; if (!snapshot.error) snapshot = { ...snapshot, ready: true, error: "浏览器禁止本地存储，请允许本站存储后重试。" }; }
  return snapshot;
}
function subscribe(listener: () => void) {const stop=subscribeBackend(listener);
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
  window.addEventListener("storage", storage); window.addEventListener(change, listener);
  return () => {stop(); window.removeEventListener("storage", storage); window.removeEventListener(change, listener); };
}
export function useLocalIntakes() { const local=useSyncExternalStore(subscribe, read, () => server);const backend=useBackendState();return useMemo(()=>backend?{records:backend.intakes,signatures:backend.signatures,ready:true,error:""}:local,[backend,local]); }
export function useRepairDirectory() {
  const local = useLocalIntakes();
  const { workflows } = useRepairWorkflows();
  const backend = useBackendMode();
  const state=useBackendState();
  return useMemo(() => (state?.directory ?? [...(backend?[]:fixtureDirectory), ...local.records.map(intakeDirectoryEntry)]).map(order => overlayRepair(order, workflows[order.id])), [backend, state?.directory, local.records, workflows]);
}
// Preview saves retain the browser-local envelope; backend saves use the command boundary.
export function intakePolicyFromSettings():IntakePolicy {
  if(isBackendClient()){const settings=backendSnapshot()?.settings;if(!settings) throw new Error("门店设置尚未载入。");return {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone};}
  const settings=parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1"));
  return {months:settings.repairWarrantyMonths,shopName:settings.shopName,address:settings.address,phone:settings.phone};
}
export function saveLocalIntake(data: IntakeReceiptData, expectedRevision=0, signature?:IntakeSignatureDraft, expectedSignatureCount=0, attachments?: IntakePhotoAttachment[]) {
  if(isBackendClient()) return backendCommand("intake.save",{data,revision:expectedRevision,signature,signatureCount:expectedSignatureCount,...(attachments !== undefined ? {photos:attachments} : {})}).then(state=>{const saved=state.intakes.find(row=>row.id===data.id);if(!saved) throw new Error("保存结果暂不可用，请重新读取工单后核对。");return saved;});
  const actor = requirePreviewPermission("repairs.edit");
  if(data.retailOrigin) throw new Error("销售售后来源只能通过单机档案建立。");
  return persistIntake(data, "repairs.edit", actor.id,expectedRevision,signature,expectedSignatureCount);
}
function writeEnvelope(records:IntakeReceiptData[],signatures:IntakeSignature[],permission:Permission,actorId:string) {
  const raw = JSON.stringify({ version: 1, records, signatures }); parseLocalIntakes(raw);
  if (requirePreviewPermission(permission).id !== actorId) throw new Error("预览身份已变化，请重新核对接机来源。");
  try { window.localStorage.setItem(key, raw); }
  catch { throw new Error("本地保存失败，请检查浏览器存储空间后重试。"); }
  cachedRaw=raw;snapshot={records,signatures,ready:true,error:""};
  window.dispatchEvent(new Event(change));
}
function persistIntake(data: IntakeReceiptData, permission: Permission, actorId: string, expectedRevision=0, signature?:IntakeSignatureDraft, expectedSignatureCount=0) {
  if (!validLocalIntake(data)) throw new Error("请重新核对接机资料。");
  const raw=window.localStorage.getItem(key);
  const records=parseLocalIntakes(raw); const signatures=parseIntakeSignatures(raw);
  const existing=records.find(item=>item.id===data.id);
  if((existing?.revision ?? (existing?1:0))!==expectedRevision) throw new Error("接机资料已变化，请重新打开最新工单核对。");
  if (!existing && records.length >= 100) throw new Error("本地预览已达到 100 张工单，请联系管理员处理。");
  if(existing?.retailOrigin) throw new Error("售后接机快照不能改写。");
  const policy=existing?.policy ?? intakePolicyFromSettings();
  if(data.policy && JSON.stringify(data.policy)!==JSON.stringify(policy)) throw new Error("门店保修资料已变化，请重新核对。");
  const saved={...data,policy,revision:expectedRevision+1};
  const next=existing?records.map(item=>item.id===data.id?saved:item):[...records,saved];
  const nextSignatures=signature?appendIntakeSignature(signatures,saved,policy,signature,actorId,expectedSignatureCount):signatures;
  writeEnvelope(next,nextSignatures,permission,actorId); return saved;
}
export function saveIntakeSignature(data:IntakeReceiptData,policy:IntakePolicy,signature:IntakeSignatureDraft,expectedCount:number) {
  if(isBackendClient()) return backendCommand("intake.signature",{id:data.id,revision:data.revision??1,policy,signature,count:expectedCount});
  const actor=requirePreviewPermission("repairs.edit");
  const raw=window.localStorage.getItem(key);const records=parseLocalIntakes(raw);const signatures=parseIntakeSignatures(raw);
  const stored=records.find(item=>item.id===data.id);
  const fixture=getRepairOrder(data.id);
  const latest=stored ?? (fixture?fixtureIntakeReceipt(fixture):null);
  if(!latest || (stored && (stored.revision??1)!==(data.revision??1))) throw new Error("工单已变化或不存在，请重新核对。");
  const currentPolicy=latest.policy ?? intakePolicyFromSettings();
  if(JSON.stringify(currentPolicy)!==JSON.stringify(policy)) throw new Error("门店保修资料已变化，请重新签署。");
  const next=appendIntakeSignature(signatures,latest,currentPolicy,signature,actor.id,expectedCount);
  if(next===signatures) return;
  writeEnvelope(records,next,"repairs.edit",actor.id);
}

export function createRetailAfterSaleRepair(unitId:string,saleId:string,caseId:string) {
  if(isBackendClient()){const state=backendSnapshot();const unit=state?.retail.find(row=>row.id===unitId);if(!unit) throw new Error("单机资料尚未载入。");const previous=unit.sales.find(row=>row.id===saleId)?.afterSales?.find(row=>row.id===caseId)?.repairId;const repairId=previous??("LOCAL-"+crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase());return backendCommand("retail.aftersale_repair",{unitId,saleId,caseId,repairId,version:unit.version}).then(()=>repairId);}

  const actor = requirePreviewPermission("sale.aftersales");
  const units=parseStoredRetailUnits(window.localStorage.getItem("chinatech.m1.retail.v1"),retailUnits);
  const unit=units.find(value=>value.id===unitId);
  const sale=unit?.sales.find(value=>value.id===saleId);
  const request=sale?.afterSales?.find(value=>value.id===caseId);
  if(!unit || !sale || !request || request.closed || request.cancelled || currentRetailSale(unit)?.id!==saleId || sale.returned || unit.status !== "sold") throw new Error("只能为当前未退回销售建立维修；原售后历史保留。");
  const records=parseLocalIntakes(window.localStorage.getItem(key));
  const existing=records.find(value=>value.retailOrigin?.unitId===unitId && value.retailOrigin.saleId===saleId && value.retailOrigin.caseId===caseId);
  if(existing) { if (request.repairId && request.repairId !== existing.id) throw new Error("售后关联工单与来源不一致，请人工核对。"); return existing.id; }
  if (request.repairId) throw new Error("已关联售后维修记录无法读取，不能另建工单覆盖原关联。");
  const product=saleProductUnit(unit,sale);
  if(!product || !sale.customerPhone) throw new Error("原销售商品或买家快照不完整，须先人工核对原凭证。");
  const now=intakeRecordTime();
  const id="LOCAL-"+crypto.randomUUID().replaceAll("-", "").slice(0,16).toUpperCase();
  if (records.some(record => record.id === id)) throw new Error("工单编号重复，请重试；现有工单未被覆盖。");
  const data:IntakeReceiptData={id,createdAt:now,updatedAt:now,previewAt:now,retailOrigin:{unitId,saleId,caseId},custody:request.custody === "left" ? "store" : "customer",customerName:sale.customerName||"",phone:sale.customerPhone,email:sale.customerEmail||"",category:retailCategories[product.category],brand:product.brand,model:product.model,color:product.color,serial:product.imei1||product.serial,issue:request.issue,accessories:[],services:structuredClone(emptyIntakeServices),priority:"普通",photoCount:0};
  const raw=JSON.stringify({version:1,records:[...records,data]});parseLocalIntakes(raw);
  persistIntake(data, "sale.aftersales", actor.id);return id;
}
