import type {
  CustomerIntakeSearchInput,
  CustomerListFilters,
  CustomerListPageInput,
} from "@/lib/repairdesk/api";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  list: (filters: CustomerListFilters = {}, storeId?: string | null) =>
    [...customersKeys.lists(), ...storeQueryScope(storeId), filters] as const,
  listPage: (input: CustomerListPageInput = {}, storeId?: string | null) =>
    [...customersKeys.lists(), "page", ...storeQueryScope(storeId), input] as const,
  detail: (id: string, storeId?: string | null) =>
    [...customersKeys.all, "detail", id, ...storeQueryScope(storeId)] as const,
  search: (query: string, limit = 6, storeId?: string | null) =>
    [...customersKeys.all, "search", ...storeQueryScope(storeId), query, limit] as const,
  intakeSearch: (input: CustomerIntakeSearchInput, storeId?: string | null) =>
    [...customersKeys.all, "intake-search", ...storeQueryScope(storeId), input] as const,
  devices: (customerId: string, storeId?: string | null) =>
    [...customersKeys.all, "devices", customerId, ...storeQueryScope(storeId)] as const,
};
