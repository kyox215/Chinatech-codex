import { describe, expect, it } from "vitest";

import { isOrderArchivedForQueue } from "./order-list-visibility";

const deliveredAt = "2026-07-12T12:00:00.000Z";

describe("order list visibility", () => {
  it("archives only terminal orders with delivery, closure, and an exact paid tuple", () => {
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
        delivered_at: deliveredAt,
      }),
    ).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "cancelled",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
        delivered_at: deliveredAt,
      }),
    ).toBe(true);
  });

  it.each([
    {
      name: "closed and paid without handover",
      order: {
        status: "completed",
        workflow_status: "closed" as const,
        is_paid: true,
        payment_status: "paid" as const,
        balance_amount: 0,
      },
    },
    {
      name: "cancelled while custody is unresolved",
      order: {
        status: "cancelled",
        workflow_status: "closed" as const,
        is_paid: true,
        payment_status: "paid" as const,
        balance_amount: 0,
      },
    },
    {
      name: "delivered with outstanding balance",
      order: {
        status: "completed",
        workflow_status: "closed" as const,
        is_paid: false,
        payment_status: "partial" as const,
        balance_amount: 20,
        delivered_at: deliveredAt,
      },
    },
    {
      name: "zero balance with contradictory payment flags",
      order: {
        status: "completed",
        workflow_status: "closed" as const,
        is_paid: false,
        payment_status: "unpaid" as const,
        balance_amount: 0,
        delivered_at: deliveredAt,
      },
    },
    {
      name: "active status with stale terminal fields",
      order: {
        status: "repaired",
        workflow_status: "closed" as const,
        is_paid: true,
        payment_status: "paid" as const,
        balance_amount: 0,
        delivered_at: deliveredAt,
      },
    },
  ])("keeps $name in the operational queue", ({ order }) => {
    expect(isOrderArchivedForQueue(order)).toBe(false);
  });

  it("uses the legacy status when canonical workflow is absent", () => {
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
        delivered_at: deliveredAt,
      }),
    ).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "notified",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
        delivered_at: deliveredAt,
      }),
    ).toBe(false);
  });
});
