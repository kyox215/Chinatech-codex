import type { InventoryListFilters } from "@/lib/repairdesk/types";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const buybackKeys = {
  all: ["buyback"] as const,
  lists: () => [...buybackKeys.all, "list"] as const,
  list: (filters: InventoryListFilters = {}, storeId?: string | null) =>
    [...buybackKeys.lists(), ...storeQueryScope(storeId), filters] as const,
  details: () => [...buybackKeys.all, "detail"] as const,
  detail: (id: string, storeId?: string | null) =>
    [...buybackKeys.details(), id, ...storeQueryScope(storeId)] as const,
  history: (id: string, storeId?: string | null) =>
    [...buybackKeys.detail(id, storeId), "quote-history"] as const,
};
