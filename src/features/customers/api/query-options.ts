import { queryOptions } from "@tanstack/react-query";

import {
  getCustomerDetail,
  listCustomersPage,
  type CustomerListPageInput,
} from "@/lib/repairdesk/api";
import { CACHE_TIMES } from "@/lib/query-performance";

import { customersKeys } from "./query-keys";

export const CUSTOMER_LIST_PAGE_SIZE = 30;

export const defaultCustomerListPageInput: CustomerListPageInput = {
  work: "all",
  page: 1,
  pageSize: CUSTOMER_LIST_PAGE_SIZE,
};

export function customerListPageQueryOptions(
  input: CustomerListPageInput = defaultCustomerListPageInput,
  storeId?: string | null,
) {
  return queryOptions({
    queryKey: customersKeys.listPage(input, storeId),
    queryFn: ({ signal }) => listCustomersPage(input, { signal }),
    staleTime: CACHE_TIMES.hotList,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function customerDetailQueryOptions(customerId: string, storeId?: string | null) {
  return queryOptions({
    queryKey: customersKeys.detail(customerId, storeId),
    queryFn: ({ signal }) => getCustomerDetail(customerId, { signal }),
    staleTime: CACHE_TIMES.detail,
  });
}
