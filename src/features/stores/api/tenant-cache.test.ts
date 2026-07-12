import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { suppliersKeys } from "@/features/suppliers/api/query-keys";
import {
  applySwitchedStoreContext,
  clearAuthorityLostQueryCache,
  clearAuthoritySensitiveQueryCache,
} from "@/features/stores/api/tenant-cache";
import type { StoreContext } from "@/lib/repairdesk/types";

describe("tenant cache helpers", () => {
  it("cancels and clears old tenant data while preserving the switched store context", async () => {
    const queryClient = new QueryClient();
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries");
    const nextContext: StoreContext = {
      activeStore: {
        id: "store_2",
        name: "Siracusa",
        slug: "siracusa",
        role: "owner",
        status: "active",
      },
      stores: [],
    };

    queryClient.setQueryData(ordersKeys.detail("ord_a", "store_1"), { id: "ord_a" });
    queryClient.setQueryData(customersKeys.detail("cust_a", "store_1"), { id: "cust_a" });
    queryClient.setQueryData(inventoryKeys.detail("item_a", "store_1"), { id: "item_a" });
    queryClient.setQueryData(messageSettingsKeys.storeScoped("store_1"), { store_id: "store_1" });
    queryClient.setQueryData(messageSettingsKeys.templatesScoped("store_1"), [{ id: "tpl_a" }]);
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(platformKeys.onboardingStatus, { activeStore: { id: "store_1" } });

    await applySwitchedStoreContext(queryClient, nextContext);

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: storesKeys.context }, { silent: true });
    expect(queryClient.getQueryData(storesKeys.context)).toEqual(nextContext);
    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(messageSettingsKeys.storeScoped("store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(messageSettingsKeys.templatesScoped("store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
  });

  it("removes authority-sensitive data after a role or grant change", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ordersKeys.detail("ord_a", "store_1"), { id: "ord_a" });
    queryClient.setQueryData(customersKeys.detail("cust_a", "store_1"), { id: "cust_a" });
    queryClient.setQueryData(inventoryKeys.detail("item_a", "store_1"), { id: "item_a" });
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(storesKeys.context, { activeStore: { id: "store_1" } });

    await clearAuthoritySensitiveQueryCache(queryClient);

    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.context)).toEqual({
      activeStore: { id: "store_1" },
    });
  });

  it("drops tenant data and stale authority sources after a 401 or 403", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ordersKeys.detail("ord_a", "store_1"), { id: "ord_a" });
    queryClient.setQueryData(customersKeys.detail("cust_a", "store_1"), { id: "cust_a" });
    queryClient.setQueryData(inventoryKeys.detail("item_a", "store_1"), { id: "item_a" });
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(storesKeys.context, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(platformKeys.onboardingStatus, {
      activeStore: { id: "store_1" },
    });

    clearAuthorityLostQueryCache(queryClient);

    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.context)).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
  });
});
