import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const storesKeys = {
  context: ["stores", "context"] as const,
  members: ["stores", "members"] as const,
  membersScoped: (storeId?: string | null) =>
    [...storesKeys.members, ...storeQueryScope(storeId)] as const,
  accessRequests: ["stores", "access-requests"] as const,
  accessRequestsScoped: (storeId?: string | null) =>
    [...storesKeys.accessRequests, ...storeQueryScope(storeId)] as const,
};
