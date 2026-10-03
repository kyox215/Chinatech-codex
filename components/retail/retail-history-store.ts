"use client";
import { useBackendState, useBackendMode } from "@/lib/backend/react";
import { useMemo } from "react";
import { projectRetailHistory, type RetailHistoryRecord } from "@/lib/retail-history";
import { useStaff } from "@/components/staff/use-staff";

const empty: RetailHistoryRecord[] = [];
export function useRetailHistory() {
  const state = useBackendState();
  const staff = useStaff();
  const records = useMemo(() => projectRetailHistory(state?.retailHistory ?? empty, staff.member), [state?.retailHistory, staff.member]);
  return { records,
    ready: staff.ready, error: useBackendMode() && !state ? "历史整机资料暂不可用。" : "" };
}
