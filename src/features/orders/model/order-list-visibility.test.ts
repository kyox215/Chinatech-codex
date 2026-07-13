import { describe, expect, it } from "vitest";

import { isOrderArchivedForQueue } from "./order-list-visibility";

const deliveredAt = "2026-07-12T12:00:00.000Z";

describe("order list visibility", () => {
  it.each([
    {
      name: "completed without handover",
      order: {
        status: "completed",
        workflow_status: "closed" as const,
        is_paid: true,
        payment_status: "paid" as const,
        balance_amount: 0,
      },
    },
    {
      name: "cancelled with unresolved custody",
      order: {
        status: "cancelled",
        workflow_status: "closed" as const,
        is_paid: true,
        payment_status: "paid" as const,
        balance_amount: 0,
      },
    },
    {
      name: "completed with an outstanding balance",
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
      name: "completed with contradictory payment flags",
      order: {
        status: "completed",
        workflow_status: "closed" as const,
        is_paid: false,
        payment_status: "unpaid" as const,
        balance_amount: 0,
        delivered_at: deliveredAt,
      },
    },
  ])("keeps $name out of the default pending queue", ({ order }) => {
    expect(isOrderArchivedForQueue(order)).toBe(true);
  });

  it.each(["new", "mail_in_progress", "parts_ordered", "parts_arrived", "repaired", "notified"])(
    "keeps nonterminal status %s visible even with stale closed, delivered, and paid fields",
    (status) => {
      expect(
        isOrderArchivedForQueue({
          status,
          workflow_status: "closed",
          is_paid: true,
          payment_status: "paid",
          balance_amount: 0,
          delivered_at: deliveredAt,
        }),
      ).toBe(false);
    },
  );

  it.each(["completed", "cancelled"])(
    "uses terminal status %s when canonical fields are absent",
    (status) => {
      expect(
        isOrderArchivedForQueue({
          status,
          is_paid: false,
          payment_status: "unpaid",
          balance_amount: 80,
        }),
      ).toBe(true);
    },
  );
});
