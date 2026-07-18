import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const procurementKeys = {
  all: ["parts-procurement"] as const,
  overview: (storeId?: string | null, orderId?: string) =>
    [...procurementKeys.all, "overview", ...storeQueryScope(storeId), orderId ?? "all"] as const,
  costCurrencies: (storeId?: string | null, mode: "settings" | "options" = "options") =>
    [...procurementKeys.all, "cost-currencies", mode, ...storeQueryScope(storeId)] as const,
};
