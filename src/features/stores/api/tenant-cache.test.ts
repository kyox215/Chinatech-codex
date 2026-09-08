import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventorySalesKeys } from "@/features/inventory/sales/api/query-keys";
import { aiAssistantKeys } from "@/features/ai-assistant/api";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { inventoryLifecycleKeys } from "@/features/inventory/lifecycle/api/query-keys";
import { inventoryCatalogKeys } from "@/features/inventory/products/api/query-keys";
import { kioskKeys } from "@/features/kiosk/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { memosKeys } from "@/features/memos/api/query-keys";
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
  it.each(["switch", "authority", "lost"] as const)(
    "cancels in-flight sales and removes cached customer/receipt on %s",
    async (mode) => {
      const client = new QueryClient();
      const key = inventorySalesKeys.summary("item", "old-store");
      const receiptKey = inventorySalesKeys.receipt(
        "sale",
        "payment",
        "payment",
        "it",
        "old-store",
      );
      const customerKey = customersKeys.detail("customer", "old-store");
      const listKey = inventorySalesKeys.list({}, "old-store");
      const detailKey = inventorySalesKeys.detail("sale", "old-store");
      client.setQueryData(listKey, { synthetic: "sales list" });
      client.setQueryData(detailKey, { synthetic: "sales detail" });
      client.setQueryData(receiptKey, { synthetic: "private receipt" });
      client.setQueryData(customerKey, { synthetic: "customer" });
      let signal: AbortSignal | undefined;
      let release: (value: unknown) => void = () => undefined;
      const pending = client
        .fetchQuery({
          queryKey: key,
          queryFn: (context) => {
            signal = context.signal;
            return new Promise((resolve) => {
              release = resolve;
            });
          },
        })
        .catch(() => undefined);
      if (mode === "switch")
        await applySwitchedStoreContext(client, { stores: [], activeStoreExplicit: false });
      else if (mode === "authority") await clearAuthoritySensitiveQueryCache(client);
      else clearAuthorityLostQueryCache(client);
      expect(signal?.aborted).toBe(true);
      release({ stale: "must not reappear" });
      await pending;
      expect(client.getQueryData(listKey)).toBeUndefined();
      expect(client.getQueryData(detailKey)).toBeUndefined();
      expect(client.getQueryData(key)).toBeUndefined();
      expect(client.getQueryData(receiptKey)).toBeUndefined();
      expect(client.getQueryData(customerKey)).toBeUndefined();
    },
  );
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
    queryClient.setQueryData(
      inventoryCatalogKeys.search({ category: "phone", brand: "Apple" }, "store_1"),
      [{ category: "phone", brand: "Apple", model: "iPhone 17", source: "learned" }],
    );
    queryClient.setQueryData(
      inventoryCatalogKeys.search({ category: "phone", brand: "Samsung" }, "store_2"),
      [{ category: "phone", brand: "Samsung", model: "Galaxy A56", source: "learned" }],
    );
    const unrelatedStoreQueryKey = ["unrelated", "store_1"] as const;
    queryClient.setQueryData(unrelatedStoreQueryKey, { keep: true });
    queryClient.setQueryData(inventoryLifecycleKeys.summary("item_a", "store_1"), {
      stock_unit_id: "item_a",
      allowed_actions: ["inspection.save"],
    });
    queryClient.setQueryData(messageSettingsKeys.storeScoped("store_1"), { store_id: "store_1" });
    queryClient.setQueryData(messageSettingsKeys.templatesScoped("store_1"), [{ id: "tpl_a" }]);
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(platformKeys.onboardingStatus, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(storesKeys.bootstrap, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(aiAssistantKeys.capabilities("store_1"), { stale: true });
    queryClient.setQueryData(memosKeys.detail("store_1", "memo_a"), { content: "private" });

    await applySwitchedStoreContext(queryClient, nextContext);

    expect(cancelQueries).toHaveBeenCalledWith({ queryKey: storesKeys.context }, { silent: true });
    expect(queryClient.getQueryData(storesKeys.context)).toEqual(nextContext);
    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(
        inventoryCatalogKeys.search({ category: "phone", brand: "Apple" }, "store_1"),
      ),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(
        inventoryCatalogKeys.search({ category: "phone", brand: "Samsung" }, "store_2"),
      ),
    ).toBeUndefined();
    expect(queryClient.getQueryData(unrelatedStoreQueryKey)).toEqual({ keep: true });
    expect(
      queryClient.getQueryData(inventoryLifecycleKeys.summary("item_a", "store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(messageSettingsKeys.storeScoped("store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(messageSettingsKeys.templatesScoped("store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.bootstrap)).toBeUndefined();
    expect(queryClient.getQueryData(aiAssistantKeys.capabilities("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(memosKeys.detail("store_1", "memo_a"))).toBeUndefined();
  });

  it("removes authority-sensitive data after a role or grant change", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ordersKeys.detail("ord_a", "store_1"), { id: "ord_a" });
    queryClient.setQueryData(customersKeys.detail("cust_a", "store_1"), { id: "cust_a" });
    queryClient.setQueryData(inventoryKeys.detail("item_a", "store_1"), { id: "item_a" });
    queryClient.setQueryData(
      inventoryCatalogKeys.search({ category: "phone", query: "iphone" }, "store_1"),
      [{ category: "phone", brand: "Apple", model: "iPhone 17", source: "learned" }],
    );
    queryClient.setQueryData(inventoryLifecycleKeys.summary("item_a", "store_1"), {
      stock_unit_id: "item_a",
      allowed_actions: ["inspection.save"],
    });
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(storesKeys.context, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(storesKeys.bootstrap, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(aiAssistantKeys.capabilities("store_1"), { stale: true });
    queryClient.setQueryData(memosKeys.detail("store_1", "memo_a"), { content: "private" });

    await clearAuthoritySensitiveQueryCache(queryClient);

    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(
        inventoryCatalogKeys.search({ category: "phone", query: "iphone" }, "store_1"),
      ),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(inventoryLifecycleKeys.summary("item_a", "store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.context)).toEqual({
      activeStore: { id: "store_1" },
    });
    expect(queryClient.getQueryData(storesKeys.bootstrap)).toEqual({
      activeStore: { id: "store_1" },
    });
    expect(queryClient.getQueryData(aiAssistantKeys.capabilities("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(memosKeys.detail("store_1", "memo_a"))).toBeUndefined();
  });

  it("drops tenant data and stale authority sources after a 401 or 403", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(ordersKeys.detail("ord_a", "store_1"), { id: "ord_a" });
    queryClient.setQueryData(customersKeys.detail("cust_a", "store_1"), { id: "cust_a" });
    queryClient.setQueryData(inventoryKeys.detail("item_a", "store_1"), { id: "item_a" });
    queryClient.setQueryData(inventoryLifecycleKeys.summary("item_a", "store_1"), {
      stock_unit_id: "item_a",
      allowed_actions: ["inspection.save"],
    });
    queryClient.setQueryData(kioskKeys.sessions("store_1"), [{ id: "session_a" }]);
    queryClient.setQueryData(suppliersKeys.storeScoped("store_1"), [{ id: "supplier_a" }]);
    queryClient.setQueryData(storesKeys.membersScoped("store_1"), [{ id: "member_a" }]);
    queryClient.setQueryData(storesKeys.accessRequestsScoped("store_1"), [{ id: "request_a" }]);
    queryClient.setQueryData(storesKeys.context, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(platformKeys.onboardingStatus, {
      activeStore: { id: "store_1" },
    });
    queryClient.setQueryData(storesKeys.bootstrap, { activeStore: { id: "store_1" } });
    queryClient.setQueryData(aiAssistantKeys.capabilities("store_1"), { stale: true });
    queryClient.setQueryData(memosKeys.detail("store_1", "memo_a"), { content: "private" });

    clearAuthorityLostQueryCache(queryClient);

    expect(queryClient.getQueryData(ordersKeys.detail("ord_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(customersKeys.detail("cust_a", "store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(inventoryKeys.detail("item_a", "store_1"))).toBeUndefined();
    expect(
      queryClient.getQueryData(inventoryLifecycleKeys.summary("item_a", "store_1")),
    ).toBeUndefined();
    expect(queryClient.getQueryData(kioskKeys.sessions("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(suppliersKeys.storeScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.membersScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.accessRequestsScoped("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.context)).toBeUndefined();
    expect(queryClient.getQueryData(platformKeys.onboardingStatus)).toBeUndefined();
    expect(queryClient.getQueryData(storesKeys.bootstrap)).toBeUndefined();
    expect(queryClient.getQueryData(aiAssistantKeys.capabilities("store_1"))).toBeUndefined();
    expect(queryClient.getQueryData(memosKeys.detail("store_1", "memo_a"))).toBeUndefined();
  });
});
