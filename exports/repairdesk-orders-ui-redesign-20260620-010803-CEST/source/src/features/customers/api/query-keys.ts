import type { CustomerListFilters, CustomerListPageInput } from "@/lib/repairdesk/api";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  list: (filters: CustomerListFilters = {}) => [...customersKeys.lists(), filters] as const,
  listPage: (input: CustomerListPageInput = {}) =>
    [...customersKeys.lists(), "page", input] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
  search: (query: string, limit = 6) => [...customersKeys.all, "search", query, limit] as const,
  intakeSearch: (query: string, limit = 6, deviceLimit = 4) =>
    [...customersKeys.all, "intake-search", query, limit, deviceLimit] as const,
  devices: (customerId: string) => [...customersKeys.all, "devices", customerId] as const,
};
