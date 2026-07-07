import { storeQueryScope } from "@/shared/lib/store-query-scope";

export const messageSettingsKeys = {
  store: ["store-settings"] as const,
  storeScoped: (storeId?: string | null) =>
    [...messageSettingsKeys.store, ...storeQueryScope(storeId)] as const,
  templates: ["message-templates"] as const,
  templatesScoped: (storeId?: string | null) =>
    [...messageSettingsKeys.templates, ...storeQueryScope(storeId)] as const,
  all: ["message-settings"] as const,
};
