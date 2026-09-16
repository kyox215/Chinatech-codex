"use client";

import {
  hashKey,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { orderQueueSummaryQueryOptions } from "@/features/orders/api/query-options";
import type { OrderQueueSummary, OrderQueueSummaryInput } from "@/lib/repairdesk/types";

function combineOrderPages(queries: UseQueryResult<OrderQueueSummary>[]) {
  return {
    summaries: queries.map((query) => query.data),
    loading: queries.some((query) => query.isFetching),
    failure: queries.find((query) => query.isError),
  };
}

/** Keep each batch in the existing tenant-scoped cache so realtime invalidation still applies. */
export function useOrderQueueFeed(
  input: OrderQueueSummaryInput,
  storeId: string | undefined,
  userId: string | null | undefined,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const refreshing = useRef(false);
  const firstQueryKey = orderQueueSummaryQueryOptions({ ...input, page: 1 }, storeId).queryKey;
  const firstQueryHash = hashKey(firstQueryKey);
  const scope = JSON.stringify([storeId, userId, { ...input, page: 1 }]);
  const [requested, setRequested] = useState({ scope, pages: 1 });
  useEffect(() => {
    setRequested({ scope, pages: 1 });
  }, [scope]);
  const requestedPages = requested.scope === scope ? requested.pages : 1;
  const first = useQuery({
    ...orderQueueSummaryQueryOptions({ ...input, page: 1 }, storeId),
    enabled,
  });
  const identity = JSON.stringify([storeId, userId]);
  const previousMetadata = useRef<{ identity: string; data: OrderQueueSummary } | null>(null);
  const metadata =
    first.data ??
    (previousMetadata.current?.identity === identity ? previousMetadata.current.data : undefined);
  useEffect(() => {
    if (first.data) previousMetadata.current = { identity, data: first.data };
  }, [first.data, identity]);
  const pages = Math.min(requestedPages, first.data?.list.pageCount || 1);
  const remaining = useQueries({
    queries: Array.from({ length: Math.max(0, pages - 1) }, (_, index) => ({
      ...orderQueueSummaryQueryOptions({ ...input, page: index + 2 }, storeId),
      enabled: enabled && Boolean(first.data),
      retry: false,
    })),
    combine: combineOrderPages,
  });
  const loadingMore = remaining.loading;
  const nextPageError = remaining.failure;
  const data = useMemo(() => {
    if (!first.data) return undefined;
    const seen = new Set<string>();
    const items = [first.data, ...remaining.summaries]
      .flatMap((summary) => summary?.list.items ?? [])
      .filter((order) => {
        if (seen.has(order.id)) return false;
        seen.add(order.id);
        return true;
      });
    return { ...first.data, list: { ...first.data.list, items } };
  }, [first.data, remaining.summaries]);
  const hasMore = pages < (first.data?.list.pageCount ?? 1);
  const loadMore = useCallback(() => {
    if (
      refreshing.current ||
      !enabled ||
      first.isFetching ||
      first.isError ||
      loadingMore ||
      nextPageError ||
      !hasMore
    )
      return;
    setRequested({ scope, pages: pages + 1 });
  }, [enabled, first.isFetching, first.isError, hasMore, loadingMore, nextPageError, pages, scope]);
  const refetchFirst = first.refetch;
  const refetch = useCallback(async () => {
    refreshing.current = true;
    setRequested({ scope, pages: 1 });
    // A refreshed head changes page boundaries. Fresh cached tails must never be appended to it.
    const tailQueries = {
      predicate: (query: Query) => {
        const tailInput = query.queryKey.at(-1) as OrderQueueSummaryInput | undefined;
        return (
          typeof tailInput === "object" &&
          Number(tailInput?.page) > 1 &&
          hashKey([...query.queryKey.slice(0, -1), { ...tailInput, page: 1 }]) === firstQueryHash
        );
      },
    };
    try {
      await queryClient.cancelQueries(tailQueries);
      queryClient.removeQueries(tailQueries);
      return await refetchFirst();
    } finally {
      refreshing.current = false;
    }
  }, [firstQueryHash, queryClient, refetchFirst, scope]);
  return {
    ...first,
    data,
    metadata,
    refetch,
    isPlaceholderData: false,
    loadingMore,
    hasMore,
    loadMore,
    nextPageError: Boolean(nextPageError),
    retryNextPage: () => nextPageError?.refetch(),
  };
}
