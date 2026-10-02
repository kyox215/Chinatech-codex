"use client";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { useSyncExternalStore } from "react";
import { defaultStoreSettings, parseStoreSettings, type StoreSettings } from "@/lib/store-settings";
import { readStaffSnapshot, staffServerSnapshot, subscribeStaff, requirePreviewPermission } from "@/lib/staff-client";
import { can } from "@/lib/staff";
const key = "chinatech.m1.store-settings.v1";
const change = "chinatech-store-settings-change";
const server = { settings: defaultStoreSettings, ready: false, error: "" };
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=server;
let snapshot = server; let cachedRaw: string | null | undefined;
function read() {if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;remoteSnapshot={settings:current?.settings??{...defaultStoreSettings,finance:[],suppliers:[],address:"",phone:""},ready:true,error:current?"":"后台资料暂不可用。"};}return remoteSnapshot;} try { const raw = window.localStorage.getItem(key); if (raw !== cachedRaw || !snapshot.ready || snapshot.error) { const settings = parseStoreSettings(raw); cachedRaw = raw; snapshot = { settings, ready: true, error: "" }; } } catch { if (!snapshot.error || !snapshot.ready) snapshot = { ...snapshot, ready: true, error: "本地设置无法读取，现有资料未被覆盖。" }; } return snapshot; }
function subscribe(listener: () => void) {const stop=subscribeBackend(listener); const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); }; window.addEventListener("storage", storage); window.addEventListener(change, listener); return () => {stop(); window.removeEventListener("storage", storage); window.removeEventListener(change, listener); }; }
export function useStoreSettings() { const state=useSyncExternalStore(subscribe,read,()=>server);const staff=useSyncExternalStore(subscribeStaff,readStaffSnapshot,()=>staffServerSnapshot);return {...state,settings:can(staff.member,"financial.read")?state.settings:{...state.settings,finance:[]}}; }
export function saveStoreSettings(expectedRevision: number, update: (current: StoreSettings) => StoreSettings) {
  if(isBackendClient()){const current=backendSnapshot()?.settings;if(!current) throw new Error("设置尚未载入。");return backendCommand("settings.save",{revision:expectedRevision,settings:update(structuredClone(current))});}
  const current = parseStoreSettings(window.localStorage.getItem(key));
  if (current.revision !== expectedRevision) throw new Error("设置已变化，请核对最新资料后重试。");
  const before = JSON.parse(JSON.stringify(current)) as StoreSettings;
  const next = { ...update(current), revision: current.revision + 1 };
  if (JSON.stringify(next.finance) !== JSON.stringify(before.finance)) requirePreviewPermission("financial.edit");
  if (["shopName","address","phone","paper","suppliers","repairWarrantyMonths","retailWarrantyMonths"].some(key=>JSON.stringify(next[key as keyof StoreSettings]) !== JSON.stringify(before[key as keyof StoreSettings]))) requirePreviewPermission("settings.edit");
  if (JSON.stringify({...next,revision:before.revision}) === JSON.stringify(before)) return;
  const raw = JSON.stringify({ version: 1, settings: next }); parseStoreSettings(raw);
  try { window.localStorage.setItem(key, raw); } catch { throw new Error("本地保存失败，现有资料未改变。"); }
  window.dispatchEvent(new Event(change));
}
