import { describe, expect, it } from "vitest";

import {
  approvalFlowStatusFromLegacyStatus,
  paymentStatusFromMoney,
} from "./canonical-order-status";

describe("canonical order status helpers", () => {
  it("only treats pending approval as customer waiting while the order is in approval state", () => {
    expect(approvalFlowStatusFromLegacyStatus("new", "pending")).toBe("not_required");
    expect(approvalFlowStatusFromLegacyStatus("waiting_approval", "pending")).toBe(
      "waiting_customer",
    );
  });

  it("marks zero-balance orders as paid even if legacy is_paid is stale", () => {
    expect(paymentStatusFromMoney({ isPaid: false, depositAmount: 0, balanceAmount: 0 })).toBe(
      "paid",
    );
  });
});
