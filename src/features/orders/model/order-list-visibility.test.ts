import { describe, expect, it } from "vitest";

import { isOrderArchivedForQueue } from "./order-list-visibility";

describe("order list visibility", () => {
  it("archives only cancelled or closed-and-paid orders", () => {
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "cancelled",
        workflow_status: "closed",
        is_paid: false,
        payment_status: "unpaid",
        balance_amount: 20,
      }),
    ).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        workflow_status: "closed",
        is_paid: false,
        payment_status: "unpaid",
        balance_amount: 20,
      }),
    ).toBe(false);
    expect(
      isOrderArchivedForQueue({
        status: "repairing",
        workflow_status: "repair",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe(false);
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        workflow_status: "closed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 10,
      }),
    ).toBe(false);
  });

  it("uses the legacy status when canonical workflow is absent", () => {
    expect(
      isOrderArchivedForQueue({
        status: "completed",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe(true);
    expect(
      isOrderArchivedForQueue({
        status: "notified",
        is_paid: true,
        payment_status: "paid",
        balance_amount: 0,
      }),
    ).toBe(false);
  });
});
