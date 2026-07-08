import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { platformKeys } from "@/features/platform/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { applySwitchedStoreContext } from "@/features/stores/api/tenant-cache";
import type { StoreContext } from "@/lib/repairdesk/types";

describe("tenant cache helpers", () => {
  it("clears old tenant data while preserving the switched store context", () => {
    const queryClient = new QueryClient();
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
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(platformKeys.onboardingStatus, { activeStore: { id: "store_1" } });

    applySwitchedStoreContext(queryClient, nextContext);

    expect(queryClient.getQueryData(storesKeys.context)).toEqual(nextContext);
    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(messageSettingsKeys.storeScoped("store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(messageSettingsKeys.templatesScoped("store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
  });
});
