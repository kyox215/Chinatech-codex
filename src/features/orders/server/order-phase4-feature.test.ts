import { describe, expect, it } from "vitest";

import {
  isOrderDataWorkbookV3ExportEnabledForStore,
  isOrderDataWorkbookV3ImportEnabledForStore,
  isOrderRelatedOrderV2EnabledForStore,
  isOrderStructuredFactsV2EnabledForStore,
} from "./order-phase4-feature";

describe("order phase 4 feature gates", () => {
  it("fails closed unless flag and store allowlist both match", () => {
    const enabled = {
      NODE_ENV: "production",
      ORDER_STRUCTURED_FACTS_V2_ENABLED: "1",
      ORDER_STRUCTURED_FACTS_V2_STORE_ALLOWLIST: "store-a,store-b",
      ORDER_RELATED_ORDER_V2_ENABLED: "1",
      ORDER_RELATED_ORDER_V2_STORE_ALLOWLIST: "store-a",
      ORDER_DATA_WORKBOOK_V3_EXPORT_ENABLED: "1",
      ORDER_DATA_WORKBOOK_V3_IMPORT_ENABLED: "1",
      ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST: "store-a",
    };
    expect(isOrderStructuredFactsV2EnabledForStore("store-a", enabled)).toBe(true);
    expect(isOrderStructuredFactsV2EnabledForStore("store-c", enabled)).toBe(false);
    expect(isOrderRelatedOrderV2EnabledForStore(undefined, enabled)).toBe(false);
    expect(isOrderDataWorkbookV3ExportEnabledForStore("store-a", enabled)).toBe(true);
    expect(isOrderDataWorkbookV3ImportEnabledForStore("store-a", enabled)).toBe(true);
  });

  it("keeps export and import independently reversible", () => {
    const env = {
      NODE_ENV: "production",
      ORDER_DATA_WORKBOOK_V3_EXPORT_ENABLED: "1",
      ORDER_DATA_WORKBOOK_V3_IMPORT_ENABLED: "0",
      ORDER_DATA_WORKBOOK_V3_STORE_ALLOWLIST: "store-a",
    };
    expect(isOrderDataWorkbookV3ExportEnabledForStore("store-a", env)).toBe(true);
    expect(isOrderDataWorkbookV3ImportEnabledForStore("store-a", env)).toBe(false);
  });
});
