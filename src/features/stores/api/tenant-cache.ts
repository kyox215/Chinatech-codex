import type { QueryClient } from "@tanstack/react-query";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";
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

export async function clearAuthoritySensitiveQueryCache(queryClient: QueryClient) {
  for (const queryKey of authoritySensitiveQueryRoots) {
    void queryClient.cancelQueries({ queryKey }, { silent: true });
    queryClient.removeQueries({ queryKey, type: "inactive" });
    void queryClient.resetQueries({ queryKey, type: "active" }, { cancelRefetch: true });
  }
}

export function clearAuthorityLostQueryCache(queryClient: QueryClient) {
  for (const queryKey of authoritySensitiveQueryRoots) {
    void queryClient.cancelQueries({ queryKey }, { silent: true });
    queryClient.removeQueries({ queryKey });
  }

  clearCachedQueryData(queryClient, storesKeys.context);
  clearCachedQueryData(queryClient, platformKeys.onboardingStatus);
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
  kioskKeys.all,
  suppliersKeys.all,
  messageSettingsKeys.store,
  messageSettingsKeys.templates,
  messageSettingsKeys.all,
  storesKeys.context,
  storesKeys.members,
  storesKeys.accessRequests,
  platformKeys.onboardingStatus,
] as const;

const authoritySensitiveQueryRoots = [
  ordersKeys.all,
  customersKeys.all,
  inventoryKeys.all,
  kioskKeys.all,
  suppliersKeys.all,
  messageSettingsKeys.store,
  messageSettingsKeys.templates,
  storesKeys.members,
  storesKeys.accessRequests,
] as const;

function clearCachedQueryData(queryClient: QueryClient, queryKey: readonly unknown[]) {
  queryClient.getQueryCache().find({ queryKey, exact: true })?.setState({
    data: undefined,
    dataUpdatedAt: 0,
  });
}
