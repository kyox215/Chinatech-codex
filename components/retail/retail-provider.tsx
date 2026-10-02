"use client";

import { createContext, useContext, useReducer, useSyncExternalStore } from "react";
import { retailUnits } from "@/lib/retail-fixtures";
import { applyRetailCommand, createRetailUnit, parseStoredRetailUnits, type RetailCommand, type RetailEvent, type RetailUnit } from "@/lib/retail";

import { readStaffSnapshot, staffServerSnapshot, subscribeStaff, requirePreviewPermission } from "@/lib/staff-client";
import { parseLocalIntakes } from "@/lib/repair-intake-record";
import { projectRetailForStaff, requireRetailAfterSaleRepair, retailCommandPermission } from "@/lib/retail-access";

const storageKey = "chinatech.m1.retail.v1";
const changeEvent = "chinatech-retail-change";
const server = { units: retailUnits, ready: false, error: "" };
let cachedRaw: string | null | undefined;
let snapshot = server;
function read() {
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
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) listener(); };
  window.addEventListener("storage", storage); window.addEventListener(changeEvent, listener);
  return () => { window.removeEventListener("storage", storage); window.removeEventListener(changeEvent, listener); };
}
type Feedback = { id: string; error: boolean; message: string } | null;
type State = { units: RetailUnit[]; ready: boolean; error: string; returnTo: string; returnScroll: number; feedback: Feedback };
type Action = { type: "create"; unit: RetailUnit; event: RetailEvent } | { type: "command"; id: string; command: RetailCommand; event: RetailEvent; version: number } | { type: "remember"; url: string; scroll: number };
type UiState = Pick<State, "returnTo" | "returnScroll" | "feedback">;
type UiAction = { type: "remember"; url: string; scroll: number } | { type: "feedback"; feedback: Feedback };
function uiReducer(state: UiState, action: UiAction): UiState { return action.type === "remember" ? { ...state, returnTo: action.url, returnScroll: action.scroll } : { ...state, feedback: action.feedback }; }

const RetailContext = createContext<State & { dispatch: (action: Action) => boolean } | null>(null);
export function RetailProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, read, () => server);
  const staff = useSyncExternalStore(subscribeStaff, readStaffSnapshot, () => staffServerSnapshot);
  const [ui, uiDispatch] = useReducer(uiReducer, { returnTo: "/app/retail", returnScroll: 0, feedback: null });
  function dispatch(action: Action) {
    if (action.type === "remember") { uiDispatch(action); return true; }
    const id = action.type === "create" ? action.unit.id : action.id;
    try {
      const authorize = () => {
        const actor = requirePreviewPermission(action.type === "create" ? "retail.edit" : retailCommandPermission(action.command));
        if (action.type === "create") { if (action.unit.costCents !== null || action.unit.refurbCents !== null) requirePreviewPermission("financial.edit"); if (action.unit.priceCents !== null) requirePreviewPermission("retail.price"); }
        if (action.type === "command" && action.command.type === "deliver" && action.command.debt) requirePreviewPermission("sale.debt");
        return actor;
      };
      const actor = authorize();
      const event = { ...action.event, actorId: actor.id, actorName: actor.name, ...(action.type === "command" && action.command.type === "edit" && ["costCents","refurbCents"].includes(action.command.change.field) ? {sensitive:"financial" as const} : {}) };
      let units: RetailUnit[];
      try { units = parseStoredRetailUnits(window.localStorage.getItem(storageKey), retailUnits); }
      catch { throw new Error("本地单机资料无法读取，现有资料未被覆盖。请检查浏览器存储权限。"); }
      if (action.type === "create") {
        if (units.length >= 500) throw new Error("本地预览已达到 500 件单机。");
        units = [createRetailUnit(action.unit, units, event), ...units];
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
      uiDispatch({ type: "feedback", feedback: { id, error: false, message: action.type === "create" ? "独立单机档案已保存到当前浏览器，状态为待检测。" : action.command.type === "sell" ? "售出记录已保存到当前浏览器，并关联客户档案。收款及交付仍待确认。" : "本次操作已保存并追加到单机历史。" } });
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
