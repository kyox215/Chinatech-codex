import { queryOptions } from "@tanstack/react-query";

import type { MemoListInput } from "@/features/memos/model/contracts";
import { getMemoSummary, listMemoAssignees, listMemos } from "@/lib/repairdesk/api";

import { memosKeys } from "./query-keys";

export function memoListQueryOptions(input: MemoListInput, storeId?: string) {
  return queryOptions({
    queryKey: memosKeys.list(storeId, input),
    queryFn: ({ signal }) => listMemos(input, { signal }),
    enabled: Boolean(storeId),
    staleTime: 15_000,
  });
}

export function memoSummaryQueryOptions(storeId?: string) {
  return queryOptions({
    queryKey: memosKeys.summary(storeId),
    queryFn: ({ signal }) => getMemoSummary({ signal }),
    enabled: Boolean(storeId),
    staleTime: 15_000,
  });
}

export function memoAssigneesQueryOptions(storeId?: string) {
  return queryOptions({
    queryKey: memosKeys.assignees(storeId),
    queryFn: ({ signal }) => listMemoAssignees({ signal }),
    enabled: Boolean(storeId),
    staleTime: 60_000,
  });
}
