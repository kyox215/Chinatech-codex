import type { InventoryListFilters } from "@/lib/repairdesk/types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (filters: InventoryListFilters = {}) => [...inventoryKeys.lists(), filters] as const,
  stats: () => [...inventoryKeys.all, "stats"] as const,
  details: () => [...inventoryKeys.all, "detail"] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
};
