import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  readInventorySalesList,
  readInventorySalesSummary,
  readInventorySalesDetail,
  readInventorySalesReceipt,
  runInventorySalesCommand,
} from "@/lib/repairdesk/api";
import { inventoryProductKeys } from "@/features/inventory/products/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryLifecycleKeys } from "@/features/inventory/lifecycle/api/query-keys";
import { inventorySalesKeys } from "./query-keys";
import type {
  InventorySalesCommandBody,
  InventorySalesReceiptInput,
  InventorySalesListInput,
} from "../model/contracts";

export const inventorySalesListOptions = (input: InventorySalesListInput, storeId: string) =>
  queryOptions({
    queryKey: inventorySalesKeys.list(input, storeId),
    queryFn: () => readInventorySalesList(input),
  });
export const inventorySalesSummaryOptions = (id: string, storeId: string) =>
  queryOptions({
    queryKey: inventorySalesKeys.summary(id, storeId),
    queryFn: () => readInventorySalesSummary(id),
  });
export const inventorySalesDetailOptions = (id: string, storeId: string) =>
  queryOptions({
    queryKey: inventorySalesKeys.detail(id, storeId),
    queryFn: () => readInventorySalesDetail(id),
  });
export const inventorySalesReceiptOptions = (input: InventorySalesReceiptInput, storeId: string) =>
  queryOptions({
    queryKey: inventorySalesKeys.receipt(
      input.id,
      input.kind,
      input.payment_id,
      input.language,
      storeId,
    ),
    queryFn: () => readInventorySalesReceipt(input),
    gcTime: 0,
    staleTime: 0,
  });
export async function invalidateInventorySales(client: QueryClient, storeId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: inventorySalesKeys.store(storeId) }),
    ...[inventoryProductKeys.all, inventoryKeys.all, inventoryLifecycleKeys.all].map((queryKey) =>
      client.invalidateQueries({
        queryKey,
        predicate: (query) => query.queryKey.includes(storeId),
      }),
    ),
  ]);
}
export function useInventorySalesCommand(storeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: InventorySalesCommandBody) => runInventorySalesCommand(input),
    onSuccess: () => invalidateInventorySales(client, storeId),
  });
}
