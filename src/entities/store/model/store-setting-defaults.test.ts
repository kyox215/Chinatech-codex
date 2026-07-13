import { describe, expect, it } from "vitest";

import {
  normalizeStoreInventoryWarrantyDefault,
  resolveNewInventoryWarrantyMonths,
  resolveStoredInventoryWarrantyMonths,
  STORE_INVENTORY_WARRANTY_RANGE,
  STORE_RULE_DEFAULTS,
} from "@/entities/store/model/store-setting-defaults";
import { DEFAULT_STORE_SETTINGS } from "@/features/messages/model/message-template-defaults";

describe("store setting defaults", () => {
  it("keeps the restore-default draft aligned with newly provisioned store defaults", () => {
    expect(STORE_RULE_DEFAULTS).toEqual({
      default_order_warranty_months: DEFAULT_STORE_SETTINGS.default_order_warranty_months,
      default_inventory_warranty_months: DEFAULT_STORE_SETTINGS.default_inventory_warranty_months,
    });
  });

  it("publishes the same inclusive inventory warranty range used by validation", () => {
    expect(STORE_INVENTORY_WARRANTY_RANGE).toEqual({ min: 0, max: 120 });
  });

  it("uses the store default only when a new inventory item has no explicit override", () => {
    expect(resolveNewInventoryWarrantyMonths(undefined, 18)).toBe(18);
    expect(resolveNewInventoryWarrantyMonths(0, 18)).toBe(0);
    expect(resolveNewInventoryWarrantyMonths(24, 18)).toBe(24);
  });

  it("normalizes store defaults to the validated range and preserves stored zero", () => {
    expect(normalizeStoreInventoryWarrantyDefault(-1)).toBe(0);
    expect(normalizeStoreInventoryWarrantyDefault(121)).toBe(120);
    expect(normalizeStoreInventoryWarrantyDefault("invalid")).toBe(12);
    expect(resolveStoredInventoryWarrantyMonths(0)).toBe(0);
    expect(resolveStoredInventoryWarrantyMonths(null)).toBe(12);
  });
});
