import { queryOptions } from "@tanstack/react-query";

import {
  getOrder,
  getOrderQueueSummary,
  listOrderWorkflow,
  type OrderQueueSummaryInput,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";

import { ordersKeys } from "./query-keys";

export const ORDER_QUEUE_PAGE_SIZE = 50;

export const defaultOrderQueueSummaryInput: OrderQueueSummaryInput = {
  page: 1,
  pageSize: ORDER_QUEUE_PAGE_SIZE,
};

export function orderQueueSummaryQueryOptions(
  input: OrderQueueSummaryInput = defaultOrderQueueSummaryInput,
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: ordersKeys.queueSummary(input, storeId),
    queryFn: ({ signal }) => getOrderQueueSummary(input, { signal }),
    staleTime: CACHE_TIMES.hotList,
  });
}

export function orderWorkflowQueryOptions(storeId?: string | null) {
  return queryOptions({
    queryKey: ordersKeys.workflow(storeId),
    queryFn: ({ signal }) => listOrderWorkflow({ signal }),
    staleTime: CACHE_TIMES.workflow,
  });
}

export function orderDetailQueryOptions(id: string, storeId?: string | null) {
  return queryOptions({
    queryKey: ordersKeys.detail(id, storeId),
    queryFn: ({ signal }) => getOrder(id, { signal }),
    staleTime: CACHE_TIMES.detail,
  });
}
