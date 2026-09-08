import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { inventorySalesKeys } from "./query-keys";
import { invalidateInventorySales } from "./queries";
import { inventoryProductKeys } from "@/features/inventory/products/api/query-keys";
import { inventoryLifecycleKeys } from "@/features/inventory/lifecycle/api/query-keys";
import {
  getRepairDeskRealtimeQueryKeyForGroup,
  getRepairDeskRealtimeQueryGroupsForDomain,
} from "@/features/realtime/model/query-invalidation-map";
describe("sales cache scope", () => {
  it("invalidates affected store products, lifecycle and sales after success only", async () => {
    const client = new QueryClient();
    const own = [
      inventorySalesKeys.summary("item", "synthetic-a"),
      inventoryProductKeys.detail("item", "synthetic-a"),
      inventoryLifecycleKeys.summary("item", "synthetic-a"),
    ];
    const other = [
      inventorySalesKeys.summary("item", "synthetic-b"),
      inventoryProductKeys.detail("item", "synthetic-b"),
      inventoryLifecycleKeys.summary("item", "synthetic-b"),
    ];
    [...own, ...other].forEach((key) => client.setQueryData(key, {}));
    await invalidateInventorySales(client, "synthetic-a");
    own.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    other.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
    expect(getRepairDeskRealtimeQueryKeyForGroup("inventory.sales", "synthetic-a")).toEqual(
      inventorySalesKeys.store("synthetic-a"),
    );
    expect(getRepairDeskRealtimeQueryGroupsForDomain("inventory")).toEqual(
      expect.arrayContaining(["inventory.sales", "inventory.products", "inventory.lifecycle"]),
    );
  });
});
