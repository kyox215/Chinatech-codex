"use client";
import { useBackendState, useBackendStore } from "@/components/backend-snapshot";
import { useMemo } from "react";
import { isBackendClient } from "@/lib/backend/client";
import { projectRetailHistory, type RetailHistoryRecord } from "@/lib/retail-history";
import { useStaff } from "@/components/staff/use-staff";
import { parsePreviewRetailHistory, previewRetailHistoryKey } from "@/lib/retail-record";

const empty: RetailHistoryRecord[] = [];
let cachedRaw: string | null | undefined;
let local = { records: empty, error: "" };
const server = { records: empty, error: "" };
function readLocal() {
  if (isBackendClient()) return server;
  try {
    const raw = window.localStorage.getItem(previewRetailHistoryKey);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try { local = { records: parsePreviewRetailHistory(raw), error: "" }; }
      catch { local = { records: empty, error: "商品原资料无法读取，现有记录未被覆盖。" }; }
    }
  } catch { if (!local.error) local = { records: empty, error: "商品原资料无法读取，现有记录未被覆盖。" }; }
  return local;
}
function subscribeLocal(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === previewRetailHistoryKey || event.key === null) listener(); };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
export function useRetailHistory() {
  const backend = useBackendState();
  const preview = useBackendStore(subscribeLocal,readLocal,server,current=>({records:current?.retailHistory??empty,error:current?"":"历史整机资料暂不可用。"}));
  const staff = useStaff();
  const source = preview.records;
  const records = useMemo(() => projectRetailHistory(source, staff.member), [source, staff.member]);
  return { records,
    ready: staff.ready, error: backend.formal && !backend.snapshot ? "历史整机资料暂不可用。" : preview.error };
}
