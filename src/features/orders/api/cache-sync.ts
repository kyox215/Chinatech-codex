import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type {
  DashboardSummary,
  OrderDetail,
  OrderListItem,
  OrderListResult,
  OrderQueueSummary,
} from "@/lib/repairdesk/types";

import { ordersKeys } from "./query-keys";

export const ordersQueueSummaryCachePrefix = [...ordersKeys.all, "queue-summary"] as const;
export const ordersListPageCachePrefix = [...ordersKeys.lists(), "page"] as const;
export const ordersDashboardSummaryCachePrefix = [...ordersKeys.all, "dashboard-summary"] as const;

export type OrderListItemCachePatch = {
  parts_supplier_id?: string | null;
  updated_at?: string;
};

export type OrderReadCacheSnapshot = {
  listPages: Array<[QueryKey, OrderListResult | undefined]>;
  queueSummaries: Array<[QueryKey, OrderQueueSummary | undefined]>;
  dashboardSummaries: Array<[QueryKey, DashboardSummary | undefined]>;
  details: Array<[QueryKey, OrderDetail | undefined]>;
};

export function snapshotOrderReadCaches(
  queryClient: QueryClient,
  orderId: string,
): OrderReadCacheSnapshot {
  return {
    listPages: queryClient.getQueriesData<OrderListResult>({
      queryKey: ordersListPageCachePrefix,
    }),
    queueSummaries: queryClient.getQueriesData<OrderQueueSummary>({
      queryKey: ordersQueueSummaryCachePrefix,
    }),
    dashboardSummaries: queryClient.getQueriesData<DashboardSummary>({
      queryKey: ordersDashboardSummaryCachePrefix,
    }),
    details: queryClient.getQueriesData<OrderDetail>({
      queryKey: orderDetailCachePrefix(orderId),
    }),
  };
}

export function restoreOrderReadCaches(
  queryClient: QueryClient,
  snapshot?: OrderReadCacheSnapshot,
) {
  if (!snapshot) return;
  snapshot.listPages.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
  snapshot.queueSummaries.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
  snapshot.dashboardSummaries.forEach(([queryKey, data]) =>
    queryClient.setQueryData(queryKey, data),
  );
  snapshot.details.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

export function patchOrderReadCaches(
  queryClient: QueryClient,
  orderId: string,
  patch: OrderListItemCachePatch,
) {
  queryClient.setQueriesData<OrderListResult>({ queryKey: ordersListPageCachePrefix }, (page) => {
    if (!page) return page;
    const items = patchOrderListItems(page.items, orderId, patch);
    return items === page.items ? page : { ...page, items };
  });

  queryClient.setQueriesData<OrderQueueSummary>(
    { queryKey: ordersQueueSummaryCachePrefix },
    (summary) => {
      if (!summary) return summary;
      const list = patchOrderListItems(summary.list.items, orderId, patch);
      if (list === summary.list.items) return summary;
      return { ...summary, list: { ...summary.list, items: list } };
    },
  );

  queryClient.setQueriesData<OrderDetail>(
    { queryKey: orderDetailCachePrefix(orderId) },
    (detail) => {
      if (!detail) return detail;
      return { ...detail, order: patchOrderListItem(detail.order, patch) };
    },
  );
}

export function invalidateOrderReadCaches(queryClient: QueryClient, orderId?: string) {
  void queryClient.invalidateQueries({ queryKey: ordersQueueSummaryCachePrefix });
  void queryClient.invalidateQueries({ queryKey: ordersDashboardSummaryCachePrefix });
  void queryClient.invalidateQueries({ queryKey: ordersKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: ordersKeys.stats() });
  if (orderId) {
    void queryClient.invalidateQueries({ queryKey: orderDetailCachePrefix(orderId) });
  }
}

export function isOrderVersionConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /工单已被更新|expected_updated_at|conflict|版本/i.test(message);
}

function orderDetailCachePrefix(orderId: string) {
  return [...ordersKeys.all, "detail", orderId] as const;
}

function patchOrderListItems(
  items: OrderListItem[],
  orderId: string,
  patch: OrderListItemCachePatch,
) {
  let changed = false;
  const nextItems = items.map((item) => {
    if (item.id !== orderId) return item;
    changed = true;
    return patchOrderListItem(item, patch);
  });
  return changed ? nextItems : items;
}

function patchOrderListItem(order: OrderListItem, patch: OrderListItemCachePatch) {
  const next: OrderListItem = { ...order };
  if ("updated_at" in patch && patch.updated_at) {
    next.updated_at = patch.updated_at;
  }
  if ("parts_supplier_id" in patch) {
    if (patch.parts_supplier_id) {
      next.parts_supplier_id = patch.parts_supplier_id;
    } else {
      delete next.parts_supplier_id;
    }
  }
  return next;
}
