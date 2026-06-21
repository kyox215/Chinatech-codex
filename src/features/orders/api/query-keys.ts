import type { OrderListFilters } from "@/lib/repairdesk/api";

export const ordersKeys = {
  all: ["orders"] as const,
  lists: () => [...ordersKeys.all, "list"] as const,
  list: (filters: OrderListFilters = {}) => [...ordersKeys.lists(), filters] as const,
  page: (filters: OrderListFilters = {}, page = 1, pageSize = 50) =>
    [...ordersKeys.lists(), "page", filters, page, pageSize] as const,
  detail: (id: string) => [...ordersKeys.all, "detail", id] as const,
  stats: () => [...ordersKeys.all, "stats"] as const,
  options: () => ["repairdesk-options"] as const,
  workflow: () => [...ordersKeys.all, "workflow"] as const,
};
