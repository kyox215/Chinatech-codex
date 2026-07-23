import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const storesKeys = {
  bootstrap: ["stores", "bootstrap"] as const,
  context: ["stores", "context"] as const,
  lifecycle: (storeId?: string | null) =>
    ["stores", "lifecycle", ...storeQueryScope(storeId)] as const,
  members: ["stores", "members"] as const,
  membersScoped: (storeId?: string | null) =>
    [...storesKeys.members, ...storeQueryScope(storeId)] as const,
  accessRequests: ["stores", "access-requests"] as const,
  accessRequestsScoped: (storeId?: string | null) =>
    [...storesKeys.accessRequests, ...storeQueryScope(storeId)] as const,
};
