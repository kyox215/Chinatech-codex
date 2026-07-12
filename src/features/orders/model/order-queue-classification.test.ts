import { describe, expect, it } from "vitest";

import { countOrderQueueGroups, getOrderQueueGroup } from "./order-queue-classification";

const deliveredAt = "2026-07-12T12:00:00.000Z";

describe("order queue classification", () => {
  it.each([
    ["parts_arrived", "parts", "processing"],
    ["mail_in_progress", "repair", "processing"],
    ["repaired", "repair", "handover"],
    ["notified", "pickup", "handover"],
  ] as const)("classifies %s as %s work", (status, workflow_status, expected) => {
    expect(
      getOrderQueueGroup({
        status,
        workflow_status,
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe(expected);
  });

  it("keeps delivered debt in settlement and contradictory evidence in review", () => {
    expect(
      getOrderQueueGroup({
        status: "completed",
        workflow_status: "closed",
        is_paid: false,
        payment_status: "partial",
        balance_amount: 35,
        delivered_at: deliveredAt,
      }),
    ).toBe("settlement");
    expect(
      getOrderQueueGroup({
        status: "cancelled",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe("review");
  });

  it("produces one operational group per active order", () => {
    const counts = countOrderQueueGroups([
      {
        status: "parts_arrived",
        workflow_status: "parts",
        is_paid: false,
        payment_status: "unpaid",
        balance_amount: 20,
      },
      {
        status: "repaired",
        workflow_status: "repair",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      },
      {
        status: "completed",
        workflow_status: "closed",
        is_paid: false,
        payment_status: "partial",
        balance_amount: 20,
        delivered_at: deliveredAt,
      },
      {
        status: "cancelled",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      },
    ]);

    expect(counts).toEqual({ all: 4, processing: 1, handover: 1, settlement: 1, review: 1 });
  });
});
