import type { InventoryListFilters } from "@/lib/repairdesk/types";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (filters: InventoryListFilters = {}, storeId?: string | null) =>
    [...inventoryKeys.lists(), ...storeQueryScope(storeId), filters] as const,
  summary: (filters: InventoryListFilters = {}, storeId?: string | null) =>
    [...inventoryKeys.all, "summary", ...storeQueryScope(storeId), filters] as const,
  stats: () => [...inventoryKeys.all, "stats"] as const,
  details: () => [...inventoryKeys.all, "detail"] as const,
  detail: (id: string, storeId?: string | null) =>
    [...inventoryKeys.details(), id, ...storeQueryScope(storeId)] as const,
};
