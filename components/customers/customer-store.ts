"use client";
import { useBackendState, useBackendMode } from "@/lib/backend/react";
import { isBackendClient, backendSnapshot, subscribeBackend, backendCommand } from "@/lib/backend/client";
import { requirePreviewPermission } from "@/lib/staff-client";

import { useSyncExternalStore } from "react";
import { buildCustomerDirectory, parseCustomerProfiles, updateCustomerProfile, type CustomerProfile } from "@/lib/customers";
import { intakeCustomers } from "@/lib/repair-intake";
import { useLocalIntakes, useRepairDirectory } from "@/components/repairs/local-intake-store";
import { useRetail } from "@/components/backend-domain-context";
import { useRetailHistory } from "@/components/retail/retail-history-store";

const key = "chinatech.m1.customer-profiles.v1";
const change = "chinatech-customer-change";
const server = { profiles: [] as CustomerProfile[], ready: false, error: "" };
let remoteSource:ReturnType<typeof backendSnapshot>;let remoteSnapshot=server;
let cachedRaw: string | null | undefined;
let snapshot = server;
function read() {if(isBackendClient()){const current=backendSnapshot();if(current!==remoteSource){remoteSource=current;remoteSnapshot={profiles:current?.customers??[],ready:true,error:current?"":"后台资料暂不可用。"};}return remoteSnapshot;}
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== cachedRaw || !snapshot.ready) {
      cachedRaw = raw;
      try { snapshot = { profiles: parseCustomerProfiles(raw), ready: true, error: "" }; }
      catch { snapshot = { profiles: [], ready: true, error: "本地客户资料无法读取，现有资料未被覆盖。" }; }
    }
  } catch { cachedRaw = undefined; if (!snapshot.ready || !snapshot.error) snapshot = { profiles: [], ready: true, error: "浏览器禁止本地存储，客户资料暂不可保存。" }; }
  return snapshot;
}
function subscribe(listener: () => void) {const stop=subscribeBackend(listener);
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
  window.addEventListener("storage", storage); window.addEventListener(change, listener);
  return () => {stop(); window.removeEventListener("storage", storage); window.removeEventListener(change, listener); };
}
export function useCustomerDirectory() {
  const backend=useBackendState();const backendMode=useBackendMode();
  const profiles = useSyncExternalStore(subscribe, read, () => server);
  const repairs = useRepairDirectory();
  const local = useLocalIntakes();
  const retail = useRetail();
  const history = useRetailHistory();
  const seeds = [...(backendMode?[]:intakeCustomers), ...local.records.map(record => ({ phone: record.phone, name: record.customerName, email: record.email }))];
  return { customers: backend?.views?.customers?.rows ?? buildCustomerDirectory(repairs, retail.units, profiles.profiles, seeds, history.records), ready: backend?true:profiles.ready && local.ready && retail.ready && history.ready, error: backend?"": [profiles.error, local.error, retail.error, history.error].filter(Boolean).join(" ") };
}
export function saveCustomerProfile(draft: Omit<CustomerProfile, "version">, expectedVersion: number) {
  if(isBackendClient()) return backendCommand("customer.save",{draft,version:expectedVersion});
  requirePreviewPermission("customers.edit");
  let profiles: CustomerProfile[];
  try { profiles = parseCustomerProfiles(window.localStorage.getItem(key)); }
  catch { throw new Error("本地客户资料无法读取，现有资料未被覆盖。请检查浏览器存储权限。"); }
  const next = updateCustomerProfile(profiles, draft, expectedVersion);
  try { window.localStorage.setItem(key, JSON.stringify({ version: 1, profiles: next })); }
  catch { throw new Error("本地客户资料保存失败，请检查浏览器存储空间后重试。"); }
  window.dispatchEvent(new Event(change));
}
