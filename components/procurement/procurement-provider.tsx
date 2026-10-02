"use client";

import { requirePreviewPermission } from "@/lib/staff-client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { procurementRecords } from "@/lib/procurement-fixtures";
import { appendProcurementEvent, validateProcurementDraft, procurementStatus, isPreorder, type ProcurementEvent, type ProcurementRecord } from "@/lib/procurement";
import { parseProcurementState } from "@/lib/procurement-storage";
import { recordRepairUpdate, type RepairUpdates } from "@/lib/repair-list-order";

type Feedback = { recordId: string; error: boolean; message: string } | null;
export type ProcurementListView = { query: string; filter: "all" | "draft" | "cart" | "open" | "complete"; repairId: string; groupBy: string };
type State = { storageError?: string; records: ProcurementRecord[]; feedback: Feedback; listView: ProcurementListView; repairUpdates: RepairUpdates };
type Action = { type: "create"; record: ProcurementRecord } | { type: "edit"; record: ProcurementRecord; revision: number } | { type: "append"; id: string; event: ProcurementEvent; revision: number } | { type: "list-view"; view: ProcurementListView } | { type: "clear-feedback" };
type TimedAction = Action & { modifiedAt: string };

function reducer(state: State, action: TimedAction): State {
  if (action.type === "list-view") return { ...state, listView: action.view };
  if (action.type === "clear-feedback") return { ...state, feedback: null };
  const recordId = action.type === "create" || action.type === "edit" ? action.record.id : action.id;
  try {
    if (action.type === "create") {
      validateProcurementDraft(action.record);
      if (state.records.some((record) => record.id === recordId)) throw new Error("采购编号已存在。");
      return { ...state, records: [action.record, ...state.records], repairUpdates: recordRepairUpdate(state.repairUpdates, action.record.repairId, action.modifiedAt), feedback: { recordId, error: false, message: "采购草稿已创建，尚未下单。" } };
    }
    const record = state.records.find((row) => row.id === recordId);
    if (!record) throw new Error("采购记录不存在。");
    let next: ProcurementRecord;
    let message: string;
    if (action.type === "edit") {
      if (record.events.length !== action.revision || !isPreorder(record)) throw new Error("记录已变化；已下单配件不能改写，请追加新的配件条目。");
      validateProcurementDraft({ ...action.record, events: [] });
      if (action.record.repairId !== record.repairId) throw new Error("不能改变配件关联工单。");
      const details = `${record.supplier} / ${record.item} / ${record.quantity}件 → ${action.record.supplier} / ${action.record.item} / ${action.record.quantity}件`;
      let history = record;
      if (procurementStatus(record) === "cart") history = appendProcurementEvent(history, { id: `${record.id}-${action.modifiedAt}-cart-reset-${action.revision}`, type: "cart_removed", quantity: 0, time: action.modifiedAt, note: "配件资料变更，取消原购物车标记。" });
      history = appendProcurementEvent(history, { id: `${record.id}-${action.modifiedAt}-edit-${action.revision}`, type: "details_changed", quantity: 0, time: action.modifiedAt, note: details });
      next = { ...action.record, events: history.events, reference: record.reference };
      message = "配件资料已更新，请按最新资料重新标记加车。";
    } else {
      next = appendProcurementEvent(record, action.event, action.revision);
      const messages = { cart_added: "已标记加车，仍未下单。", cart_removed: "已取消加车标记。", ordered: "已标记下单。", arrival: "本次到货已登记。", correction: "更正已追加，原记录保留。", details_changed: "配件资料已更新。" };
      message = messages[action.event.type];
    }
    return { ...state, records: state.records.map((row) => row.id === recordId ? next : row), repairUpdates: recordRepairUpdate(state.repairUpdates, record.repairId, action.modifiedAt), feedback: { recordId, error: false, message } };
  } catch (error) {
    return { ...state, feedback: { recordId, error: true, message: error instanceof Error ? error.message : "操作失败，请重试。" } };
  }
}

const ProcurementContext = createContext<State & { dispatch: React.Dispatch<Action> } | null>(null);

const storageKey = "chinatech.m1.procurement.v1";
const changed = "chinatech-procurement-change";
const initialState: State = { records: procurementRecords, feedback: null, repairUpdates: {}, listView: { query: "", filter: "all", repairId: "", groupBy: "supplier" } };
let store = initialState;
let cachedRaw: string | null | undefined;
function read() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== cachedRaw || store.storageError) { const saved = parseProcurementState(raw); cachedRaw = raw; store = { ...store, records: saved?.records ?? procurementRecords, repairUpdates: saved?.repairUpdates ?? {}, storageError: "" }; }
  } catch { if (!store.storageError) store = { ...store, storageError: "本地配件记录无法读取，现有记录未被覆盖。" }; }
  return store;
}
function subscribe(listener: () => void) { const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) listener(); }; window.addEventListener("storage", storage); window.addEventListener(changed, listener); return () => { window.removeEventListener("storage", storage); window.removeEventListener(changed, listener); }; }
function dispatchAction(action: Action) {
    const current = read();
    const modifiedAt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "medium" }).format(new Date());
    let next: State;
    try {if (["create","append","edit"].includes(action.type)) requirePreviewPermission("repairs.edit");next = reducer(current, { ...action, modifiedAt });}
    catch(reason) {next = {...current,feedback:{recordId:action.type === "create" || action.type === "edit" ? action.record.id : action.type === "append" ? action.id : "",error:true,message:reason instanceof Error?reason.message:"无操作权限。"}};}
    const mutation = action.type === "create" || action.type === "append" || action.type === "edit";
    if (mutation && !next.feedback?.error) {
      try { if (current.storageError) throw new Error(current.storageError); const raw = JSON.stringify({ version: 1, records: next.records, repairUpdates: next.repairUpdates }); parseProcurementState(raw); window.localStorage.setItem(storageKey, raw); cachedRaw = raw; store = next; }
      catch (error) { store = { ...current, feedback: { recordId: action.type === "create" || action.type === "edit" ? action.record.id : action.id, error: true, message: error instanceof Error ? `本地保存失败，配件记录未改变：${error.message}` : "本地保存失败，配件记录未改变。" } }; }
    } else store = next;
    window.dispatchEvent(new Event(changed));
}
export function ProcurementProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, read, () => initialState);
  return <ProcurementContext.Provider value={{ ...state, dispatch: dispatchAction }}>{children}</ProcurementContext.Provider>;
}

export function useProcurement() {
  const context = useContext(ProcurementContext);
  if (!context) throw new Error("采购上下文缺失。");
  return context;
}
