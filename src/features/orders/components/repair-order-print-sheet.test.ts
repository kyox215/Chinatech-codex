import { describe, expect, it } from "vitest";

import { canPrintRepairOrderCustomerDocument } from "./repair-order-print-sheet";

describe("repair order customer print safety", () => {
  it("allows active terminal documents when store output is ready", () => {
    expect(canPrintRepairOrderCustomerDocument({}, true)).toBe(true);
    expect(canPrintRepairOrderCustomerDocument({ record_state: "active" }, true)).toBe(true);
  });

  it("fails closed for voided, soft-deleted, or unavailable store output", () => {
    expect(canPrintRepairOrderCustomerDocument({ record_state: "voided" }, true)).toBe(false);
    expect(
      canPrintRepairOrderCustomerDocument({ deleted_at: "2026-07-16T20:00:00.000Z" }, true),
    ).toBe(false);
    expect(canPrintRepairOrderCustomerDocument({}, false)).toBe(false);
  });
});
