"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { requirePreviewPermission } from "@/lib/staff-client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { procurementRecords } from "@/lib/procurement-fixtures";
import { appendProcurementEvent, validateProcurementDraft, procurementStatus, isPreorder, type ProcurementEvent, type ProcurementRecord } from "@/lib/procurement";
import { applyProcurementBatch, resolveSupplierId, type ProcurementBatchItem } from "@/lib/procurement-batch";
import { parseProcurementState } from "@/lib/procurement-storage";
import { recordRepairUpdate, type RepairUpdates } from "@/lib/repair-list-order";
import { parseStoreSettings } from "@/lib/store-settings";
import { can } from "@/lib/staff";
import { updateItemQuotes } from "@/lib/repair-item-pricing";
import { prepareRepairItemEdits, persistRepairItemEnvelopes, type RepairItemEdit } from "@/lib/repair-item-editor";
import { validateWorkflowExtensions, assertRepairProcurementOpen } from "@/lib/repair-workflow";
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { parseLocalIntakes, fixtureIntakeReceipt, intakeDirectoryEntry } from "@/lib/repair-intake-record";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { previewRepairWorkflow } from "@/components/repairs/repair-workflow-store";

type Feedback = { recordId: string; error: boolean; message: string } | null;
export type ProcurementListView = { query: string; filter: "all" | "draft" | "cart" | "open" | "complete"; repairId: string; groupBy: string };
type State = { storageError?: string; records: ProcurementRecord[]; feedback: Feedback; listView: ProcurementListView; repairUpdates: RepairUpdates };
export type ProcurementAction = { type:"save-items";repairId:string;intakeRevision:number;workflowRevision:number;items:RepairItemEdit[] } | { type:"save-item";record:ProcurementRecord;revision:number;workflowRevision:number;intakeRevision:number;quoteCents:number|null;noProcurement?:boolean } | { type: "create"; record: ProcurementRecord } | { type: "create-cart"; record: ProcurementRecord; workflowRevision: number; intakeRevision: number } | { type: "edit"; record: ProcurementRecord; revision: number } | { type: "append"; id: string; event: ProcurementEvent; revision: number } | { type: "link_requirement"; id: string; revision: number; requirementId: string; requirementRevision: number; note: string } | { type: "batch"; action: "ordered" | "arrival"; supplierId: string; items: ProcurementBatchItem[] } | { type: "list-view"; view: ProcurementListView } | { type: "clear-feedback" };
const recordIdOf = (action: ProcurementAction) => "record" in action ? action.record.id : "id" in action ? action.id : action.type === "save-items" ? action.repairId : action.type === "batch" ? "batch" : "";
const storageKey = "chinatech.m1.procurement.v1";
const changed = "chinatech-procurement-change";
const initialState: State = { records: procurementRecords, feedback: null, repairUpdates: {}, listView: { query: "", filter: "all", repairId: "", groupBy: "supplier" } };
let store = initialState;
let remoteSource:ReturnType<typeof backendSnapshot>;
let cachedRaw: string | null | undefined;
function previewOrder(id: string) {
  const saved = parseLocalIntakes(window.localStorage.getItem("chinatech.m1.local-intakes.v1")).find(row => row.id === id);
  const fixture = getRepairOrder(id);
  const data = saved ?? (fixture ? fixtureIntakeReceipt(fixture) : undefined);
  if (!data) throw new Error("关联工单不存在。");
  return intakeDirectoryEntry(data);
}
function checkRequirement(record: ProcurementRecord) {
  if (!record.requirementId) return;
  const order = previewOrder(record.repairId);
  const item = currentRepairRequirements(order, previewRepairWorkflow(order)).find(row => row.id === record.requirementId);
  if (!item || item.mode !== "parts" || item.revision !== record.requirementRevision) throw new Error("维修项目要求已变化，请重新核对关联。");
}
function mutate(state: State, action: Exclude<ProcurementAction, {type:"list-view"}|{type:"clear-feedback"}|{type:"save-item"}|{type:"save-items"}>, time: string, actorId: string): State {
  const id = recordIdOf(action); const suppliers = parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1")).suppliers;
  let records = state.records; let message = "配件事实已保存。"; const repairIds = new Set<string>();
  if (action.type === "batch") {
    if (action.action === "ordered") for (const item of action.items) { const row = records.find(row => row.id === item.id); if (row) { checkRequirement(row); const order=previewOrder(row.repairId); assertRepairProcurementOpen(order,previewRepairWorkflow(order)); } }
    records = applyProcurementBatch(records, action.action, action.supplierId, action.items, suppliers, { id: crypto.randomUUID(), time, actorId });
    action.items.forEach(item => { const row = records.find(row => row.id === item.id); if (row) repairIds.add(row.repairId); });
    message = action.action === "ordered" ? "所选供应商条目已记录实际下单。" : "本批实际到货已保存。";
  } else if (action.type === "create" || action.type === "create-cart") {
    validateProcurementDraft(action.record); if (records.some(row => row.id === id)) throw new Error("采购编号已存在。");
    const nextDraft = action.record; let next = nextDraft; const order = previewOrder(next.repairId);
    assertRepairProcurementOpen(order,previewRepairWorkflow(order));
    if (next.supplierId && !suppliers.some(row => row.id === next.supplierId && row.active)) throw new Error("供应商已变化，请重新选择。");
    checkRequirement(next);
    if (action.type === "create-cart") {
      if ((order.intakeRevision ?? 1) !== action.intakeRevision || previewRepairWorkflow(order).revision !== action.workflowRevision) throw new Error("接单资料或维修项目已变化，请重新核对。");
      next = appendProcurementEvent(next, { id: crypto.randomUUID(), type:"cart_added", quantity:0, time, actorId, note:"已核对配件并加入采购车。" });
      message = "已加购物车 · 未下单。";
    } else message = "采购草稿已创建，尚未下单。";
    records = [next, ...records]; repairIds.add(next.repairId);
  } else {
    const current = records.find(row => row.id === id); if (!current) throw new Error("采购记录不存在。");
    if (current.events.length !== action.revision) throw new Error("记录已变化，请重新核对。");
    let next: ProcurementRecord;
    if (action.type === "edit") {
      const order=previewOrder(current.repairId);assertRepairProcurementOpen(order,previewRepairWorkflow(order));
      if (!isPreorder(current)) throw new Error("已下单配件不能改写，请追加新条目。");
      if (current.repairId !== action.record.repairId) throw new Error("不能改变关联工单。");
      const draft = { ...current, ...action.record, events: [] }; validateProcurementDraft(draft); checkRequirement(draft);
      const supplierId = resolveSupplierId(draft, suppliers); if (!supplierId || !suppliers.some(row => row.id === supplierId && row.active)) throw new Error("请重新核对有效供应商。");
      let history = current;
      if (procurementStatus(current) === "cart") history = appendProcurementEvent(history, { id:crypto.randomUUID(), type:"cart_removed", quantity:0, time, actorId, note:"配件资料变更，取消原加车标记。" });
      history = appendProcurementEvent(history, { id:crypto.randomUUID(), type:"details_changed", quantity:0, time, actorId, note:`${current.supplier} / ${current.item} → ${draft.supplier} / ${draft.item}` });
      next = { ...draft, reference:current.reference, events:history.events }; message = "配件资料已更新，请按最新资料重新加车。";
    } else if (action.type === "link_requirement") {
      next = { ...current, requirementId:action.requirementId, requirementRevision:action.requirementRevision }; checkRequirement(next);
      if (!action.note.trim()) throw new Error("请填写关联核对说明。");
      next = appendProcurementEvent(next, { id:crypto.randomUUID(), type:"requirement_linked", quantity:0, time, actorId, note:`${current.requirementId ?? "未关联"}@${current.requirementRevision ?? "未知"} → ${action.requirementId}@${action.requirementRevision}；${action.note}` });
    } else {
      if (["ordered", "cart_added"].includes(action.event.type)) { checkRequirement(current); const order=previewOrder(current.repairId); assertRepairProcurementOpen(order,previewRepairWorkflow(order)); }
      next = appendProcurementEvent(current, { ...action.event, actorId }, action.revision);
    }
    records = records.map(row => row.id === id ? next : row); repairIds.add(current.repairId);
  }
  let repairUpdates = state.repairUpdates; for (const id of repairIds) repairUpdates = recordRepairUpdate(repairUpdates,id,time);
  return { ...state, records, repairUpdates, feedback:{recordId:id,error:false,message} };
}
function read() {
  if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;store={...store,records:current?.procurement??[],repairUpdates:Object.fromEntries((current?.intakes??[]).map(row=>[row.id,row.updatedAt])),storageError:current?"":"后台资料暂不可用。"};}return store;}
  try {const raw=window.localStorage.getItem(storageKey);if(raw!==cachedRaw||store.storageError){const saved=parseProcurementState(raw);cachedRaw=raw;store={...store,records:saved?.records??procurementRecords,repairUpdates:saved?.repairUpdates??{},storageError:""};}}
  catch {if(!store.storageError)store={...store,storageError:"本地配件记录无法读取，现有记录未被覆盖。"};}return store;
}
export function currentProcurementRecords() { return read().records; }
function subscribe(listener:()=>void){const stop=subscribeBackend(listener);const storage=(event:StorageEvent)=>{if(event.key===storageKey||event.key===null)listener();};window.addEventListener("storage",storage);window.addEventListener(changed,listener);return()=>{stop();window.removeEventListener("storage",storage);window.removeEventListener(changed,listener);};}
function savePreviewItem(current:State, action:Extract<ProcurementAction,{type:"save-item"}>, time:string) {
  const actor=requirePreviewPermission("repairs.edit");const id=action.record.repairId;
  const keys=[storageKey,"chinatech.m1.repair-workflow.v1","chinatech.m1.local-intakes.v1"];
  const before=keys.map(key=>window.localStorage.getItem(key));
  const local=parseLocalIntakes(before[2]);const intake=local.find(row=>row.id===id);const order=previewOrder(id);const workflow=previewRepairWorkflow(order);
  assertRepairProcurementOpen(order,workflow);
  if((order.intakeRevision??1)!==action.intakeRevision||workflow.revision!==action.workflowRevision)throw new Error("工单或维修项目已变化，请重新核对。");
  const existing=current.records.find(row=>row.id===action.record.id);
  if((existing?.events.length??0)!==action.revision)throw new Error("配件已变化，请重新核对。");
  if(existing&&(!isPreorder(existing)||existing.repairId!==id))throw new Error("已下单配件不能改写。");
  const canCost=can(actor,"financial.read")&&can(actor,"financial.edit");
  if(!canCost&&action.record.unitCostCents!==null)throw new Error("当前账号不能编辑采购成本。");
  const requirements=currentRepairRequirements(order,workflow);
  let requirement=action.record.requirementId?requirements.find(row=>row.id===action.record.requirementId):undefined;
  if(action.record.requirementId&&(!requirement||requirement.revision!==action.record.requirementRevision))throw new Error("维修项目要求已变化，请重新核对。");
  if(!requirement&&!existing)requirement={id:`project:${action.record.id}`,title:action.record.item,request:action.record.specification??"",revision:1,mode:"pending",confirmed:false,deviceFingerprint:order.deviceFingerprint};
  const title=requirement?.title??action.record.item;
  const quotes=[...(intake?.itemQuotes??[])];for(const row of requirements)if(!quotes.some(quote=>quote.item===row.title))quotes.push({item:row.title,amountCents:null});
  const quoteIndex=quotes.findIndex(row=>row.item===title);if(quoteIndex<0)quotes.push({item:title,amountCents:action.quoteCents});else quotes[quoteIndex]={item:title,amountCents:action.quoteCents};
  const pricing=updateItemQuotes(intake?.itemQuotes,quotes,intake?.itemQuoteHistory,{id:crypto.randomUUID(),time,actorId:actor.id});
  if(!intake&&action.quoteCents!==null)throw new Error("演示样例无法保存报价，请新建工单。");
  let records=current.records;let selected=action.record;
  if(action.noProcurement){
    if(existing||action.record.unitCostCents!==null||records.some(row=>row.repairId===id&&row.requirementId===requirement?.id&&row.required!==false))throw new Error("本项目已有采购，不能改为无需采购。");
  }else{
    const suppliers=parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1")).suppliers;
    const supplier=suppliers.find(row=>row.id===action.record.supplierId&&row.active);if(!supplier)throw new Error("请选择有效的门店供应商。");
    selected={...action.record,supplier:supplier.name,unitCostCents:canCost?action.record.unitCostCents:existing?.unitCostCents??null,...(requirement?{requirementId:requirement.id,requirementRevision:requirement.revision}:{})};validateProcurementDraft(selected);
    if(existing&&existing.requirementId!==selected.requirementId)throw new Error("不能改写原采购项目关联。");
    let history={...selected,events:existing?.events??[]};
    if(existing)history=appendProcurementEvent(history,{id:crypto.randomUUID(),type:"details_changed",quantity:0,time,actorId:actor.id,note:"配件资料已更正，按当前资料加入采购车。"});
    if(procurementStatus(history)!=="cart")history=appendProcurementEvent(history,{id:crypto.randomUUID(),type:"cart_added",quantity:0,time,actorId:actor.id,note:"已选供应商并加入采购车。"});
    selected=history;records=existing?records.map(row=>row.id===selected.id?selected:row):[selected,...records];
  }
  if(requirement){
    if(!action.noProcurement&&records.some(row=>row.repairId===id&&row.requirementId===requirement!.id&&row.required!==false&&row.requirementRevision!==requirement!.revision))throw new Error("本项目旧配件要求已变化，请重新核对关联。");
    requirement={...requirement,sourceFingerprint:order.requirements?.find(row=>row.id===requirement!.id)?.sourceFingerprint,deviceFingerprint:order.deviceFingerprint,mode:action.noProcurement?"none":"parts",confirmed:true};
  }
  const nextWorkflow={...workflow,revision:workflow.revision+1,updatedAt:time,requirements:requirement?[...requirements.filter(row=>row.id!==requirement!.id),requirement]:requirements,events:[...workflow.events,{id:crypto.randomUUID(),time,actorId:actor.id,type:"requirement" as const,label:`${title}：${action.noProcurement?"无需采购":"已选供应商"}`,note:"维修项及报价已保存。"}]};validateWorkflowExtensions(nextWorkflow);
  const workflowEnvelope=JSON.parse(before[1]??'{"version":1,"workflows":{}}');workflowEnvelope.workflows[id]=nextWorkflow;
  const intakeEnvelope=JSON.parse(before[2]??'{"version":1,"records":[]}');if(intake)intakeEnvelope.records=local.map(row=>row.id===id?{...row,...pricing,revision:(row.revision??1)+1,updatedAt:time}:row);
  const next={...current,records,repairUpdates:recordRepairUpdate(current.repairUpdates,id,time),feedback:{recordId:action.record.id,error:false,message:action.noProcurement?"报价已保存，无需采购。":"已加购物车 · 未下单。"}};
  const values=[JSON.stringify({version:1,records,repairUpdates:next.repairUpdates}),JSON.stringify(workflowEnvelope),JSON.stringify(intakeEnvelope)];parseProcurementState(values[0]);parseLocalIntakes(values[2]);
  try{keys.forEach((key,index)=>window.localStorage.setItem(key,values[index]));}catch(reason){keys.forEach((key,index)=>{try{if(before[index]===null)window.localStorage.removeItem(key);else window.localStorage.setItem(key,before[index]!);}catch{}});throw reason;}
  cachedRaw=values[0];store=next;window.dispatchEvent(new Event("chinatech-repair-workflow-change"));window.dispatchEvent(new Event("chinatech-local-intake-change"));
}
function savePreviewItems(current:State, action:Extract<ProcurementAction,{type:"save-items"}>, time:string) {
  const actor=requirePreviewPermission("repairs.edit"),workflowKey="chinatech.m1.repair-workflow.v1",intakeKey="chinatech.m1.local-intakes.v1";
  const keys=[storageKey,workflowKey,intakeKey],before=keys.map(key=>window.localStorage.getItem(key));
  const intakes=parseLocalIntakes(before[2]),intake=intakes.find(row=>row.id===action.repairId);
  if(!intake)throw new Error("演示样例无法保存维修报价，请新建工单。");
  const {type:_type,...input}=action;void _type;
  const prepared=prepareRepairItemEdits(input,{intake,workflow:previewRepairWorkflow(intakeDirectoryEntry(intake)),records:current.records,suppliers:parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1")).suppliers,canEditCost:can(actor,"financial.read")&&can(actor,"financial.edit"),activity:{id:crypto.randomUUID(),time,actorId:actor.id}});
  const changedById=new Map(prepared.changedRecords.map(row=>[row.id,row]));
  const records=[...prepared.changedRecords.filter(row=>!current.records.some(old=>old.id===row.id)),...current.records.map(row=>changedById.get(row.id)??row)];
  const repairUpdates=prepared.changedRecords.length?recordRepairUpdate(current.repairUpdates,intake.id,time):current.repairUpdates;
  const intakeEnvelope=JSON.parse(before[2]!);intakeEnvelope.records=intakes.map(row=>row.id===intake.id?prepared.intake:row);
  const intakeValue=JSON.stringify(intakeEnvelope);parseLocalIntakes(intakeValue);
  const entries=[{key:intakeKey,before:before[2],value:intakeValue}];
  let procurementValue:string|undefined;
  if(prepared.changedRecords.length){
    procurementValue=JSON.stringify({version:1,records,repairUpdates});parseProcurementState(procurementValue);
    const envelope=JSON.parse(before[1]??'{"version":1,"workflows":{}}');envelope.workflows[intake.id]=prepared.workflow;
    const workflowValue=JSON.stringify(envelope);for(const workflow of Object.values(envelope.workflows))validateWorkflowExtensions(workflow as Parameters<typeof validateWorkflowExtensions>[0]);
    entries.unshift({key:storageKey,before:before[0],value:procurementValue},{key:workflowKey,before:before[1],value:workflowValue});
  }
  persistRepairItemEnvelopes(window.localStorage,entries);
  if(procurementValue!==undefined)cachedRaw=procurementValue;
  store={...current,records,repairUpdates,feedback:{recordId:intake.id,error:false,message:prepared.changedRecords.length?"报价及供应商已保存 · 未下单。":"报价已保存。"}};
  // Publish only after every prepared envelope was persisted successfully.
  if(prepared.workflow)window.dispatchEvent(new Event("chinatech-repair-workflow-change"));
  window.dispatchEvent(new Event("chinatech-local-intake-change"));
}
async function dispatchAction(action: ProcurementAction) {
  const current=read();if(action.type==="list-view"||action.type==="clear-feedback"){store={...current,...(action.type==="list-view"?{listView:action.view}:{feedback:null})};window.dispatchEvent(new Event(changed));return;}
  const recordId=recordIdOf(action);
  try {
    if(isBackendClient()) {
      if(action.type==="batch") {const {type:_type,...payload}=action;void _type;await backendCommand("procurement.batch",payload);} else await backendCommand("procurement",action);
      read();store={...store,feedback:{recordId,error:false,message:action.type==="create-cart"?"已加购物车 · 未下单。":action.type==="save-items"?action.items.some(row=>row.purchase)?"报价及供应商已保存 · 未下单。":"报价已保存。":"配件事实已保存。"}};
    } else {
      const actor=requirePreviewPermission("repairs.edit");if(current.storageError)throw new Error(current.storageError);
      const time=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",dateStyle:"short",timeStyle:"medium"}).format(new Date());
      if(action.type==="save-item"){savePreviewItem(current,action,time);window.dispatchEvent(new Event(changed));return;}
      if(action.type==="save-items"){savePreviewItems(current,action,time);window.dispatchEvent(new Event(changed));return;}
      const next=mutate(current,action,time,actor.id);const raw=JSON.stringify({version:1,records:next.records,repairUpdates:next.repairUpdates});parseProcurementState(raw);
      window.localStorage.setItem(storageKey,raw);cachedRaw=raw;store=next;
    }
  } catch(reason){store={...read(),feedback:{recordId,error:true,message:reason instanceof Error?reason.message:"保存失败。"}};window.dispatchEvent(new Event(changed));throw reason;}
  window.dispatchEvent(new Event(changed));
}
const ProcurementContext=createContext<State & {dispatch:(action:ProcurementAction)=>Promise<void>}|null>(null);
export function ProcurementProvider({children}:{children:React.ReactNode}){const state=useSyncExternalStore(subscribe,read,()=>initialState);return <ProcurementContext.Provider value={{...state,dispatch:dispatchAction}}>{children}</ProcurementContext.Provider>;}
export function useProcurement(){const context=useContext(ProcurementContext);if(!context)throw new Error("采购上下文缺失。");return context;}
