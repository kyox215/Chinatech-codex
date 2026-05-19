import type { CustomerListFilters } from "@/lib/repairdesk/api";

export const customersKeys = {
  all: ["customers"] as const,
  lists: () => [...customersKeys.all, "list"] as const,
  list: (filters: CustomerListFilters = {}) => [...customersKeys.lists(), filters] as const,
  detail: (id: string) => [...customersKeys.all, "detail", id] as const,
  search: (query: string, limit = 6) => [...customersKeys.all, "search", query, limit] as const,
  devices: (customerId: string) => [...customersKeys.all, "devices", customerId] as const,
};
