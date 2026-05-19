import type { OrderListFilters } from "@/lib/repairdesk/api";

export const ordersKeys = {
  all: ["orders"] as const,
  lists: () => [...ordersKeys.all, "list"] as const,
  list: (filters: OrderListFilters = {}) => [...ordersKeys.lists(), filters] as const,
  detail: (id: string) => [...ordersKeys.all, "detail", id] as const,
  stats: () => [...ordersKeys.all, "stats"] as const,
  options: () => ["repairdesk-options"] as const,
};
