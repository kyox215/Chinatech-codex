import type { ProfitCenterInput } from "@/lib/repairdesk/types";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const profitKeys = {
  all: ["profit"] as const,
  center: (input: ProfitCenterInput, storeId?: string | null) =>
    [...profitKeys.all, "center", ...storeQueryScope(storeId), input] as const,
};

export const costBackfillKeys = {
  all: ["profit", "cost-backfill"] as const,
  runs: (storeId?: string | null) =>
    [...costBackfillKeys.all, ...storeQueryScope(storeId)] as const,
};
