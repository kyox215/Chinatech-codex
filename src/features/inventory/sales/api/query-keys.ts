import { storeQueryScope } from "@/shared/lib/store-query-scope";
export const inventorySalesKeys = {
  all: ["inventory-sales"] as const,
  store: (storeId?: string | null) => ["inventory-sales", ...storeQueryScope(storeId)] as const,
  list: (input: unknown, storeId?: string | null) =>
    [...inventorySalesKeys.store(storeId), "list", input] as const,
  summary: (id: string, storeId?: string | null) =>
    [...inventorySalesKeys.store(storeId), "summary", id] as const,
  detail: (id: string, storeId?: string | null) =>
    [...inventorySalesKeys.store(storeId), "detail", id] as const,
  receipt: (
    id: string,
    kind: string,
    paymentId: string | undefined,
    language: string | undefined,
    storeId?: string | null,
  ) =>
    [
      ...inventorySalesKeys.store(storeId),
      "receipt",
      id,
      kind,
      paymentId ?? null,
      language ?? null,
    ] as const,
};
