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
import { currentRepairRequirements } from "@/lib/repair-requirements";
import { parseLocalIntakes, fixtureIntakeReceipt, intakeDirectoryEntry } from "@/lib/repair-intake-record";
import { getRepairOrder } from "@/lib/repair-fixtures";
import { previewRepairWorkflow } from "@/components/repairs/repair-workflow-store";

type Feedback = { recordId: string; error: boolean; message: string } | null;
export type ProcurementListView = { query: string; filter: "all" | "draft" | "cart" | "open" | "complete"; repairId: string; groupBy: string };
type State = { storageError?: string; records: ProcurementRecord[]; feedback: Feedback; listView: ProcurementListView; repairUpdates: RepairUpdates };
export type ProcurementAction = { type: "create"; record: ProcurementRecord } | { type: "create-cart"; record: ProcurementRecord; workflowRevision: number; intakeRevision: number } | { type: "edit"; record: ProcurementRecord; revision: number } | { type: "append"; id: string; event: ProcurementEvent; revision: number } | { type: "link_requirement"; id: string; revision: number; requirementId: string; requirementRevision: number; note: string } | { type: "batch"; action: "ordered" | "arrival"; supplierId: string; items: ProcurementBatchItem[] } | { type: "list-view"; view: ProcurementListView } | { type: "clear-feedback" };
const recordIdOf = (action: ProcurementAction) => "record" in action ? action.record.id : "id" in action ? action.id : action.type === "batch" ? "batch" : "";
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
function mutate(state: State, action: Exclude<ProcurementAction, {type:"list-view"}|{type:"clear-feedback"}>, time: string, actorId: string): State {
  const id = recordIdOf(action); const suppliers = parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1")).suppliers;
  let records = state.records; let message = "配件事实已保存。"; const repairIds = new Set<string>();
  if (action.type === "batch") {
    if (action.action === "ordered") for (const item of action.items) { const row = records.find(row => row.id === item.id); if (row) checkRequirement(row); }
    records = applyProcurementBatch(records, action.action, action.supplierId, action.items, suppliers, { id: crypto.randomUUID(), time, actorId });
    action.items.forEach(item => { const row = records.find(row => row.id === item.id); if (row) repairIds.add(row.repairId); });
    message = action.action === "ordered" ? "所选供应商条目已记录实际下单。" : "本批实际到货已保存。";
  } else if (action.type === "create" || action.type === "create-cart") {
    validateProcurementDraft(action.record); if (records.some(row => row.id === id)) throw new Error("采购编号已存在。");
    const nextDraft = action.record; let next = nextDraft; const order = previewOrder(next.repairId);
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
      if (["ordered", "cart_added"].includes(action.event.type)) checkRequirement(current);
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
function subscribe(listener:()=>void){const stop=subscribeBackend(listener);const storage=(event:StorageEvent)=>{if(event.key===storageKey||event.key===null)listener();};window.addEventListener("storage",storage);window.addEventListener(changed,listener);return()=>{stop();window.removeEventListener("storage",storage);window.removeEventListener(changed,listener);};}
async function dispatchAction(action: ProcurementAction) {
  const current=read();if(action.type==="list-view"||action.type==="clear-feedback"){store={...current,...(action.type==="list-view"?{listView:action.view}:{feedback:null})};window.dispatchEvent(new Event(changed));return;}
  const recordId=recordIdOf(action);
  try {
    if(isBackendClient()) {
      if(action.type==="batch") {const {type:_type,...payload}=action;void _type;await backendCommand("procurement.batch",payload);} else await backendCommand("procurement",action);
      read();store={...store,feedback:{recordId,error:false,message:action.type==="create-cart"?"已加购物车 · 未下单。":"配件事实已保存。"}};
    } else {
      const actor=requirePreviewPermission("repairs.edit");if(current.storageError)throw new Error(current.storageError);
      const time=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome",dateStyle:"short",timeStyle:"medium"}).format(new Date());
      const next=mutate(current,action,time,actor.id);const raw=JSON.stringify({version:1,records:next.records,repairUpdates:next.repairUpdates});parseProcurementState(raw);
      window.localStorage.setItem(storageKey,raw);cachedRaw=raw;store=next;
    }
  } catch(reason){store={...read(),feedback:{recordId,error:true,message:reason instanceof Error?reason.message:"保存失败。"}};window.dispatchEvent(new Event(changed));throw reason;}
  window.dispatchEvent(new Event(changed));
}
const ProcurementContext=createContext<State & {dispatch:(action:ProcurementAction)=>Promise<void>}|null>(null);
export function ProcurementProvider({children}:{children:React.ReactNode}){const state=useSyncExternalStore(subscribe,read,()=>initialState);return <ProcurementContext.Provider value={{...state,dispatch:dispatchAction}}>{children}</ProcurementContext.Provider>;}
export function useProcurement(){const context=useContext(ProcurementContext);if(!context)throw new Error("采购上下文缺失。");return context;}
