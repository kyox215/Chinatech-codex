import { describe, expect, it } from "vitest";

import { inventoryLifecycleKeys } from "./query-keys";

describe("inventory lifecycle query keys", () => {
  it("isolates every read model by active store", () => {
    expect(inventoryLifecycleKeys.summary("item", "store-a")).not.toEqual(
      inventoryLifecycleKeys.summary("item", "store-b"),
    );
    expect(inventoryLifecycleKeys.sale("sale", "store-a")).not.toEqual(
      inventoryLifecycleKeys.sale("sale", "store-b"),
    );
    expect(inventoryLifecycleKeys.afterSales("store-a")).not.toEqual(
      inventoryLifecycleKeys.afterSales("store-b"),
    );
    expect(inventoryLifecycleKeys.afterSalesCase("case", "store-a")).not.toEqual(
      inventoryLifecycleKeys.afterSalesCase("case", "store-b"),
    );
  });
});
