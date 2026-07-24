import { describe, expect, it } from "vitest";

import { canPrintRepairOrderCustomerDocument } from "./repair-order-print-sheet";

describe("repair order customer print safety", () => {
  it("allows active terminal documents when store output is ready", () => {
    expect(canPrintRepairOrderCustomerDocument({})).toBe(true);
    expect(canPrintRepairOrderCustomerDocument({ record_state: "active" })).toBe(true);
  });

  it("allows voided and soft-deleted historical records to print", () => {
    expect(canPrintRepairOrderCustomerDocument({ record_state: "voided" })).toBe(true);
    expect(canPrintRepairOrderCustomerDocument({ deleted_at: "2026-07-16T20:00:00.000Z" })).toBe(
      true,
    );
  });
});
