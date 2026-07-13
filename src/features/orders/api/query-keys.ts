import type {
  DashboardSummaryInput,
  OrderListFilters,
  OrderQueueSummaryInput,
} from "@/lib/repairdesk/api";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const ordersKeys = {
  all: ["orders"] as const,
  lists: () => [...ordersKeys.all, "list"] as const,
  list: (filters: OrderListFilters = {}, storeId?: string | null) =>
    [...ordersKeys.lists(), ...storeQueryScope(storeId), filters] as const,
  page: (filters: OrderListFilters = {}, page = 1, pageSize = 50, storeId?: string | null) =>
    [...ordersKeys.lists(), "page", ...storeQueryScope(storeId), filters, page, pageSize] as const,
  queueSummary: (input: OrderQueueSummaryInput = {}, storeId?: string | null) =>
    [...ordersKeys.all, "queue-summary", ...storeQueryScope(storeId), input] as const,
  dashboardSummary: (input: DashboardSummaryInput = {}, storeId?: string | null) =>
    [...ordersKeys.all, "dashboard-summary", ...storeQueryScope(storeId), input] as const,
  detail: (id: string, storeId?: string | null) =>
    [...ordersKeys.all, "detail", id, ...storeQueryScope(storeId)] as const,
  stats: () => [...ordersKeys.all, "stats"] as const,
  options: (storeId?: string | null) =>
    ["repairdesk-options", ...storeQueryScope(storeId)] as const,
  workflow: (storeId?: string | null) =>
    [...ordersKeys.all, "workflow", ...storeQueryScope(storeId)] as const,
  dataBatches: (storeId?: string | null) =>
    [...ordersKeys.all, "data-batches", ...storeQueryScope(storeId)] as const,
};
