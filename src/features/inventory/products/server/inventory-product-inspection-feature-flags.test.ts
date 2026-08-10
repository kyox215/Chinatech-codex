import { describe, expect, it } from "vitest";

import {
  isInventoryProductInspectionEnabledForStore,
  isInventoryProductInspectionSchemaReady,
  isInventoryProductInspectionStoreEnabled,
} from "./inventory-product-inspection-feature-flags";

const storeId = "00000000-0000-0000-0000-000000000001";

describe("inventory product inspection feature flags", () => {
  it("stays disabled until schema, command and rollout gates are all on", () => {
    const env = {
      INVENTORY_PRODUCT_INSPECTION_SCHEMA_READY: "1",
      INVENTORY_PRODUCT_INSPECTION_ENABLED: "1",
      INVENTORY_PRODUCT_INSPECTION_ALL_STORES: "0",
      INVENTORY_PRODUCT_INSPECTION_ALLOWLIST: storeId,
      INVENTORY_PRODUCT_INSPECTION_DENYLIST: "",
    };
    expect(isInventoryProductInspectionSchemaReady(env)).toBe(true);
    expect(isInventoryProductInspectionStoreEnabled(storeId, env)).toBe(true);
    expect(isInventoryProductInspectionEnabledForStore(storeId, env)).toBe(true);
    expect(
      isInventoryProductInspectionEnabledForStore("00000000-0000-0000-0000-000000000002", env),
    ).toBe(false);
  });

  it("denylist wins over all-stores rollout", () => {
    const env = {
      INVENTORY_PRODUCT_INSPECTION_SCHEMA_READY: "1",
      INVENTORY_PRODUCT_INSPECTION_ENABLED: "1",
      INVENTORY_PRODUCT_INSPECTION_ALL_STORES: "1",
      INVENTORY_PRODUCT_INSPECTION_DENYLIST: storeId,
    };
    expect(isInventoryProductInspectionEnabledForStore(storeId, env)).toBe(false);
  });
});
