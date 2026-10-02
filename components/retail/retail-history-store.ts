"use client";
import { useMemo, useSyncExternalStore } from "react";
import { backendSnapshot, isBackendClient, subscribeBackend } from "@/lib/backend/client";
import { projectRetailHistory, type RetailHistoryRecord } from "@/lib/retail-history";
import { useStaff } from "@/components/staff/use-staff";

const empty: RetailHistoryRecord[] = [];
export function useRetailHistory() {
  const state = useSyncExternalStore(subscribeBackend, backendSnapshot, () => null);
  const staff = useStaff();
  const records = useMemo(() => projectRetailHistory(state?.retailHistory ?? empty, staff.member), [state?.retailHistory, staff.member]);
  return { records,
    ready: staff.ready, error: isBackendClient() && !state ? "历史整机资料暂不可用。" : "" };
}
