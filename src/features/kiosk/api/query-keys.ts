import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const kioskKeys = {
  all: ["kiosk"] as const,
  devices: (storeId?: string | null) =>
    [...kioskKeys.all, "devices", ...storeQueryScope(storeId)] as const,
  sessions: (storeId?: string | null) =>
    [...kioskKeys.all, "sessions", ...storeQueryScope(storeId)] as const,
};
