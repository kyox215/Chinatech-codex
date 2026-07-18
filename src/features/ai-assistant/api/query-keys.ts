import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const aiAssistantKeys = {
  all: ["ai-assistant"] as const,
  capabilities: (storeId?: string | null) =>
    [...aiAssistantKeys.all, "capabilities", ...storeQueryScope(storeId)] as const,
};
