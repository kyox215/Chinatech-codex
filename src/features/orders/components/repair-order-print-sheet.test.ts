import { describe, expect, it } from "vitest";

import { canPrintRepairOrderCustomerDocument } from "./repair-order-print-sheet";

describe("repair order customer print safety", () => {
  it("allows active terminal documents when store output is ready", () => {
    expect(canPrintRepairOrderCustomerDocument({}, true)).toBe(true);
    expect(canPrintRepairOrderCustomerDocument({ record_state: "active" }, true)).toBe(true);
  });

  it("allows voided and soft-deleted historical records to print", () => {
    expect(canPrintRepairOrderCustomerDocument({ record_state: "voided" }, true)).toBe(true);
    expect(
      canPrintRepairOrderCustomerDocument({ deleted_at: "2026-07-16T20:00:00.000Z" }, true),
    ).toBe(true);
  });
  it("requires the explicit single-order permission and a loaded record", () => {
    expect(canPrintRepairOrderCustomerDocument({})).toBe(false);
    expect(canPrintRepairOrderCustomerDocument({}, false)).toBe(false);
    expect(canPrintRepairOrderCustomerDocument(undefined, true)).toBe(false);
    expect(canPrintRepairOrderCustomerDocument({ record_state: "voided" }, false)).toBe(false);
  });
});
