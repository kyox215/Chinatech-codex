import { describe, expect, it } from "vitest";

import {
  approvalFlowStatusFromLegacyStatus,
  paymentStatusFromMoney,
  workflowStatusFromLegacyStatus,
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

  it("keeps repaired and external-repair orders in the repair workflow stage", () => {
    expect(workflowStatusFromLegacyStatus("mail_in_progress")).toBe("repair");
    expect(workflowStatusFromLegacyStatus("repairing")).toBe("repair");
    expect(workflowStatusFromLegacyStatus("repaired")).toBe("repair");
    expect(workflowStatusFromLegacyStatus("notified")).toBe("pickup");
  });
});
