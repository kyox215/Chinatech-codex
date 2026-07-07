import { describe, expect, it } from "vitest";

import { customersKeys } from "@/features/customers/api/query-keys";
import { inventoryKeys } from "@/features/inventory/api/query-keys";
import { messageSettingsKeys } from "@/features/messages/api/query-keys";
import { ordersKeys } from "@/features/orders/api/query-keys";
import { storesKeys } from "@/features/stores/api/query-keys";
import { storeQueryScope } from "@/shared/lib/store-query-scope";

describe("store-scoped query keys", () => {
  it("keeps unscoped keys backward compatible", () => {
    expect(storeQueryScope()).toEqual([]);
    expect(ordersKeys.detail("ord_1")).toEqual(["orders", "detail", "ord_1"]);
    expect(customersKeys.detail("cust_1")).toEqual(["customers", "detail", "cust_1"]);
    expect(inventoryKeys.detail("item_1")).toEqual(["inventory", "detail", "item_1"]);
    expect(messageSettingsKeys.storeScoped()).toEqual(messageSettingsKeys.store);
    expect(storesKeys.membersScoped()).toEqual(storesKeys.members);
  });

  it("adds the active store to business list and detail keys", () => {
    expect(ordersKeys.page({ search: "iphone" }, 2, 50, "store_1")).toEqual([
      "orders",
      "list",
      "page",
      "store",
      "store_1",
      { search: "iphone" },
      2,
      50,
    ]);
    expect(customersKeys.listPage({ search: "zhang" }, "store_1")).toEqual([
      "customers",
      "list",
      "page",
      "store",
      "store_1",
      { search: "zhang" },
    ]);
    expect(inventoryKeys.summary({ categories: ["phones"] }, "store_1")).toEqual([
      "inventory",
      "summary",
      "store",
      "store_1",
      { categories: ["phones"] },
    ]);
  });

  it("keeps root prefixes usable for broad invalidation", () => {
    expect(ordersKeys.detail("ord_1", "store_1").slice(0, 3)).toEqual([
      "orders",
      "detail",
      "ord_1",
    ]);
    expect(messageSettingsKeys.templatesScoped("store_1").slice(0, 1)).toEqual(
      messageSettingsKeys.templates,
    );
    expect(storesKeys.accessRequestsScoped("store_1").slice(0, 2)).toEqual(
      storesKeys.accessRequests,
    );
  });
});
