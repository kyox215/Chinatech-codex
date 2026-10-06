"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";

import { createContext, useContext, useReducer, useSyncExternalStore } from "react";
import { retailUnits } from "@/lib/retail-fixtures";
import { parseStoreSettings } from "@/lib/store-settings";
import { parsePreviewRetailHistory, prepareRetailRecord, previewRetailHistoryKey, type RetailRecordPreparation } from "@/lib/retail-record";
import { applyRetailWorkflow, retailWorkflowPermissions, type RetailWorkflow } from "@/lib/retail-workflow";
import { applyRetailCommand, createRetailUnit, validateRetailPhotos, parseStoredRetailUnits, type RetailCommand, type RetailEvent, type RetailUnit } from "@/lib/retail";

import { readStaffSnapshot, staffServerSnapshot, subscribeStaff, requirePreviewPermission } from "@/lib/staff-client";
import { parseLocalIntakes } from "@/lib/repair-intake-record";
import { projectRetailForStaff, requireRetailAfterSaleRepair, retailCommandPermission } from "@/lib/retail-access";

const storageKey = "chinatech.m1.retail.v1";
const changeEvent = "chinatech-retail-change";
const server = { units: retailUnits, ready: false, error: "" };
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=server;
let cachedRaw: string | null | undefined;
let snapshot = server;
function read() {if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;remoteSnapshot={units:current?.retail??[],ready:true,error:current?"":"后台资料暂不可用。"};}return remoteSnapshot;}
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== cachedRaw || !snapshot.ready) {
      cachedRaw = raw;
      try { snapshot = { units: parseStoredRetailUnits(raw, retailUnits), ready: true, error: "" }; }
      catch { snapshot = { ...snapshot, ready: true, error: "本地单机资料无法读取，现有资料未被覆盖。" }; }
    }
  } catch { cachedRaw = undefined; if (!snapshot.ready || !snapshot.error) snapshot = { ...snapshot, ready: true, error: "浏览器禁止本地存储，单机操作暂不可保存。" }; }
  return snapshot;
}
function subscribe(listener: () => void) {const stop=subscribeBackend(listener);
  const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) listener(); };
  window.addEventListener("storage", storage); window.addEventListener(changeEvent, listener);
  return () => {stop(); window.removeEventListener("storage", storage); window.removeEventListener(changeEvent, listener); };
}
type Feedback = { id: string; error: boolean; message: string } | null;
type State = { units: RetailUnit[]; ready: boolean; error: string; returnTo: string; returnScroll: number; feedback: Feedback };
type Action = { type: "workflow"; workflow: RetailWorkflow; event: RetailEvent } | { type: "create"; unit: RetailUnit; photos?: string[]; event: RetailEvent } | { type: "prepare"; id: string; sourceSnapshot: string; settingsRevision: number; draft: RetailRecordPreparation; event: RetailEvent } | { type: "command"; id: string; command: RetailCommand; event: RetailEvent; version: number } | { type: "remember"; url: string; scroll: number };
type UiState = Pick<State, "returnTo" | "returnScroll" | "feedback">;
type UiAction = { type: "remember"; url: string; scroll: number } | { type: "feedback"; feedback: Feedback };
function uiReducer(state: UiState, action: UiAction): UiState { return action.type === "remember" ? { ...state, returnTo: action.url, returnScroll: action.scroll } : { ...state, feedback: action.feedback }; }

const RetailContext = createContext<State & { dispatch: (action: Action) => boolean | Promise<boolean> } | null>(null);
export function RetailProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, read, () => server);
  const staff = useSyncExternalStore(subscribeStaff, readStaffSnapshot, () => staffServerSnapshot);
  const [ui, uiDispatch] = useReducer(uiReducer, { returnTo: "/app/retail", returnScroll: 0, feedback: null });
  function dispatch(action: Action) {
    if (action.type === "remember") { uiDispatch(action); return true; }
    const id = action.type === "workflow" ? (action.workflow.type === "create_ready" ? action.workflow.unit.id : action.workflow.id) : action.type === "create" ? action.unit.id : action.id;
    if (isBackendClient()) {
      const command = action.type === "command" && ["inspect", "approve", "pause", "reinspect"].includes(action.command.type) ? { ...action.command, note: "note" in action.command && action.command.note !== undefined ? action.command.note : action.event.detail } : action.type === "command" ? action.command : undefined;
      const payload = action.type === "workflow" ? action.workflow : action.type === "prepare" ? { id: action.id, sourceSnapshot: action.sourceSnapshot, settingsRevision: action.settingsRevision, draft: action.draft } : action.type === "create" ? { type: action.type, unit: action.unit, ...(action.photos !== undefined ? { photos: action.photos } : {}) } : { type: action.type, id: action.id, command, version: action.version };
      return backendCommand(action.type === "workflow" ? "retail.workflow" : action.type === "prepare" ? "retail.prepare" : "retail", payload).then(() => { uiDispatch({ type: "feedback", feedback: { id, error: false, message: "已保存并追加到历史。" } }); return true; }).catch(reason => { uiDispatch({ type: "feedback", feedback: { id, error: true, message: reason instanceof Error ? reason.message : "保存失败。" } }); return false; });
    }
    try {
      const authorize = () => {
        if (action.type === "workflow") { const actor = requirePreviewPermission("retail.view"); for (const permission of retailWorkflowPermissions(action.workflow)) requirePreviewPermission(permission); return actor; }
        requirePreviewPermission("retail.view");
        const actor = requirePreviewPermission(action.type === "create" || action.type === "prepare" ? "retail.edit" : retailCommandPermission(action.command));
        if (action.type === "prepare") { requirePreviewPermission("retail.view"); if (Object.values(action.draft.checks).some(Boolean)) requirePreviewPermission("retail.inspect"); }
        if (action.type === "create") { if (action.unit.costCents !== null || action.unit.refurbCents !== null) requirePreviewPermission("financial.edit"); if (action.unit.priceCents !== null) requirePreviewPermission("retail.price"); }
        if (action.type === "command" && action.command.type === "deliver" && action.command.debt) requirePreviewPermission("sale.debt");
        return actor;
      };
      const actor = authorize();
      const event = { ...action.event, actorId: actor.id, actorName: actor.name, ...(action.type === "command" && action.command.type === "edit" && ["costCents","refurbCents"].includes(action.command.change.field) ? {sensitive:"financial" as const} : {}) };
      let units: RetailUnit[];
      try { units = parseStoredRetailUnits(window.localStorage.getItem(storageKey), retailUnits); }
      catch { throw new Error("本地单机资料无法读取，现有资料未被覆盖。请检查浏览器存储权限。"); }
      if (action.type === "workflow") {
        if (action.workflow.type === "create_ready" && units.length >= 500) throw new Error("本地预览已达到 500 件单机。");
        if (action.workflow.type === "create_ready" && parsePreviewRetailHistory(window.localStorage.getItem(previewRetailHistoryKey)).some(record => record.id === id)) throw new Error("已有商品须在原档案核对保存。");
        const settings = parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1"));
        const updated = applyRetailWorkflow(action.workflow, units, event, settings);
        units = units.some(unit => unit.id === id) ? units.map(unit => unit.id === id ? updated : unit) : [updated, ...units];
      } else if (action.type === "create") {
        if (units.length >= 500) throw new Error("本地预览已达到 500 件单机。");
        if (action.unit.historyOrigin || parsePreviewRetailHistory(window.localStorage.getItem(previewRetailHistoryKey)).some(record => record.id === action.unit.id)) throw new Error("已有商品须在原档案核对保存。");
        let created = createRetailUnit(action.unit, units, event);
        if (action.photos !== undefined) created = applyRetailCommand(created, { type: "photos", photos: validateRetailPhotos(action.photos) }, { ...event, id: event.id + ":photos", title: "实物照片已保存" }, created.version, units);
        units = [created, ...units];
      } else if (action.type === "prepare") {
        if (units.length >= 500) throw new Error("本地预览已达到 500 件单机。");
        const record = parsePreviewRetailHistory(window.localStorage.getItem(previewRetailHistoryKey)).find(record => record.id === id);
        const settings = parseStoreSettings(window.localStorage.getItem("chinatech.m1.store-settings.v1"));
        if (!record || record.sourceSnapshot !== action.sourceSnapshot || settings.revision !== action.settingsRevision) throw new Error("商品来源或门店约定已变化，请重新核对。");
        units = [prepareRetailRecord(record, action.draft, settings.retailWarrantyMonths, event, units), ...units];
      } else {
        const unit = units.find(unit => unit.id === id);
        if (!unit) throw new Error("单机档案不存在。");
        if(action.command.type === "after_sale_link" || action.command.type === "after_sale_close") {
          requireRetailAfterSaleRepair(unit, action.command, parseLocalIntakes(window.localStorage.getItem("chinatech.m1.local-intakes.v1")), action.command.type === "after_sale_close" ? window.localStorage.getItem("chinatech.m1.repair-workflow.v1") : null);
        }
        const updated = applyRetailCommand(unit, action.command, event, action.version, units);
        if (updated === unit) {
          uiDispatch({ type: "feedback", feedback: { id, error: false, message: "资料没有变化或操作已记录，未追加历史。" } });
          return true;
        }
        units = units.map(unit => unit.id === id ? updated : unit);
      }
      // Persist before publishing success: a storage error leaves the visible fact unchanged.
      const raw = JSON.stringify({ version: 1, units });
      parseStoredRetailUnits(raw, retailUnits);
      if (authorize().id !== actor.id) throw new Error("预览身份已变化，请重新打开核对。");
      try { window.localStorage.setItem(storageKey, raw); }
      catch { throw new Error("本地保存失败，请检查浏览器存储空间后重试。"); }
      cachedRaw = raw;
      snapshot = { units, ready: true, error: "" };
      window.dispatchEvent(new Event(changeEvent));
      uiDispatch({ type: "feedback", feedback: { id, error: false, message: action.type === "create" ? "独立单机档案已保存到当前浏览器，状态为待检测。" : action.type === "command" && action.command.type === "sell" ? "售出记录已保存到当前浏览器，并关联客户档案。收款及交付仍待确认。" : "本次操作已保存并追加到单机历史。" } });
      return true;
    } catch (error) { uiDispatch({ type: "feedback", feedback: { id, error: true, message: error instanceof Error ? error.message : "请核对单机资料。" } }); return false; }
  }
  return <RetailContext.Provider value={{ ...stored, units: projectRetailForStaff(stored.units, staff.error ? null : staff.member), ready: stored.ready && staff.ready, error: stored.error || staff.error, ...ui, dispatch }}>{children}</RetailContext.Provider>;
}
export function useRetail() {
  const context = useContext(RetailContext);
  if (!context) throw new Error("整机上下文缺失。");
  return context;
}
