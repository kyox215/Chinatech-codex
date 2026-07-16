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
      name: "legacy exception-only cancellation",
      order: {
        status: "repairing",
        workflow_status: "repair" as const,
        exception_status: "cancelled" as const,
        is_paid: false,
        payment_status: "unpaid" as const,
        balance_amount: 70,
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

  it.each(["done", "cancelled"] as const)(
    "archives a custom workflow bucket %s even when legacy fields remain active",
    (workflowBucket) => {
      expect(
        isOrderArchivedForQueue({
          status: "repairing",
          workflow_status: "repair",
          workflow_bucket: workflowBucket,
        }),
      ).toBe(true);
    },
  );

  it("archives voided and soft-deleted lifecycle rows", () => {
    expect(isOrderArchivedForQueue({ status: "repairing", record_state: "voided" })).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "repairing",
        deleted_at: "2026-07-16T20:00:00.000Z",
      }),
    ).toBe(true);
  });
});
