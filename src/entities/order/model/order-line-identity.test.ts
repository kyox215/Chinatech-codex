import { describe, expect, it } from "vitest";

import { createOrderLineId, ensureOrderLineId, isOrderLineId } from "./order-line-identity";

describe("order line identity", () => {
  it("creates RFC-compatible UUID line ids", () => {
    const lineId = createOrderLineId();

    expect(isOrderLineId(lineId)).toBe(true);
  });

  it("preserves valid ids and replaces missing or malformed ids", () => {
    const existing = "00000000-0000-4000-8000-000000000101";

    expect(ensureOrderLineId(existing)).toBe(existing);
    expect(isOrderLineId(ensureOrderLineId("legacy-row"))).toBe(true);
    expect(ensureOrderLineId("legacy-row")).not.toBe("legacy-row");
  });
});
