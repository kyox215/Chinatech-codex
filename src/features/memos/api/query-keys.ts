import type { MemoListInput } from "@/features/memos/model/contracts";

export const memosKeys = {
  all: ["memos"] as const,
  store: (storeId?: string) => [...memosKeys.all, storeId ?? "no-store"] as const,
  lists: (storeId?: string) => [...memosKeys.store(storeId), "list"] as const,
  list: (storeId: string | undefined, input: MemoListInput) =>
    [...memosKeys.lists(storeId), input] as const,
  summary: (storeId?: string) => [...memosKeys.store(storeId), "summary"] as const,
  detail: (storeId: string | undefined, id: string) =>
    [...memosKeys.store(storeId), "detail", id] as const,
  assignees: (storeId?: string) => [...memosKeys.store(storeId), "assignees"] as const,
};
