import { describe, expect, it } from "vitest";

import { isOrderDataApplyEnabled, isOrderDataExportEnabled } from "./order-data-feature-flags";

describe("order data feature flags", () => {
  it("fails closed when either high-risk feature is not explicitly enabled", () => {
    expect(isOrderDataExportEnabled({})).toBe(false);
    expect(isOrderDataApplyEnabled("store-a", {})).toBe(false);
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "0" })).toBe(false);
    expect(
      isOrderDataApplyEnabled("store-a", {
        ORDER_DATA_APPLY_ENABLED: "0",
        ORDER_DATA_APPLY_STORE_ALLOWLIST: "store-a",
      }),
    ).toBe(false);
  });

  it("requires the exact value 1 and an allowlisted store", () => {
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "1" })).toBe(true);
    expect(
      isOrderDataApplyEnabled("store-a", {
        ORDER_DATA_APPLY_ENABLED: "1",
        ORDER_DATA_APPLY_STORE_ALLOWLIST: "store-a, store-b",
      }),
    ).toBe(true);
    expect(
      isOrderDataApplyEnabled("store-c", {
        ORDER_DATA_APPLY_ENABLED: "1",
        ORDER_DATA_APPLY_STORE_ALLOWLIST: "store-a,store-b",
      }),
    ).toBe(false);
    expect(
      isOrderDataApplyEnabled(undefined, {
        ORDER_DATA_APPLY_ENABLED: "1",
        ORDER_DATA_APPLY_STORE_ALLOWLIST: "store-a",
      }),
    ).toBe(false);
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "true" })).toBe(false);
    expect(
      isOrderDataApplyEnabled("store-a", {
        ORDER_DATA_APPLY_ENABLED: "yes",
        ORDER_DATA_APPLY_STORE_ALLOWLIST: "store-a",
      }),
    ).toBe(false);
  });
});
