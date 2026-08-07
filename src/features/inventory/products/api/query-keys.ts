import type { InventoryProductListFilters } from "@/lib/repairdesk/types";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const inventoryProductKeys = {
  all: ["inventory-products"] as const,
  lists: () => [...inventoryProductKeys.all, "list"] as const,
  listsForStore: (storeId?: string | null) =>
    [...inventoryProductKeys.lists(), ...storeQueryScope(storeId)] as const,
  list: (filters: InventoryProductListFilters = {}, storeId?: string | null) =>
    [...inventoryProductKeys.listsForStore(storeId), filters] as const,
  details: () => [...inventoryProductKeys.all, "detail"] as const,
  detail: (id: string, storeId?: string | null) =>
    [...inventoryProductKeys.details(), id, ...storeQueryScope(storeId)] as const,
  edit: (id: string, storeId?: string | null) =>
    [...inventoryProductKeys.all, "edit", id, ...storeQueryScope(storeId)] as const,
};
