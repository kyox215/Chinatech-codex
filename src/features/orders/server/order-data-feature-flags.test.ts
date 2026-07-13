import { describe, expect, it } from "vitest";

import { isOrderDataApplyEnabled, isOrderDataExportEnabled } from "./order-data-feature-flags";

describe("order data feature flags", () => {
  it("fails closed when either high-risk feature is not explicitly enabled", () => {
    expect(isOrderDataExportEnabled({})).toBe(false);
    expect(isOrderDataApplyEnabled({})).toBe(false);
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "0" })).toBe(false);
    expect(isOrderDataApplyEnabled({ ORDER_DATA_APPLY_ENABLED: "0" })).toBe(false);
  });

  it("requires the exact value 1", () => {
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "1" })).toBe(true);
    expect(isOrderDataApplyEnabled({ ORDER_DATA_APPLY_ENABLED: "1" })).toBe(true);
    expect(isOrderDataExportEnabled({ ORDER_DATA_EXPORT_ENABLED: "true" })).toBe(false);
    expect(isOrderDataApplyEnabled({ ORDER_DATA_APPLY_ENABLED: "yes" })).toBe(false);
  });
});
