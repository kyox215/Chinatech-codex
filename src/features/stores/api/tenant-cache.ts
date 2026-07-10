import type { QueryClient } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import type { StoreContext } from "@/lib/repairdesk/types";

export async function clearTenantScopedQueryCache(queryClient: QueryClient) {
  await Promise.all(
    tenantScopedQueryRoots.map((queryKey) =>
      queryClient.cancelQueries({ queryKey }, { silent: true }),
    ),
  );
  for (const queryKey of tenantScopedQueryRoots) {
    queryClient.removeQueries({ queryKey });
  }
}

export async function refreshStoreContextQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: storesKeys.context }),
    queryClient.invalidateQueries({ queryKey: platformKeys.onboardingStatus }),
  ]);
}

export async function applySwitchedStoreContext(queryClient: QueryClient, context: StoreContext) {
  await clearTenantScopedQueryCache(queryClient);
  queryClient.setQueryData(storesKeys.context, context);
}

const tenantScopedQueryRoots = [
  ordersKeys.all,
  customersKeys.all,
  inventoryKeys.all,
  messageSettingsKeys.store,
  messageSettingsKeys.templates,
  messageSettingsKeys.all,
  storesKeys.context,
  storesKeys.members,
  storesKeys.accessRequests,
  platformKeys.onboardingStatus,
] as const;
