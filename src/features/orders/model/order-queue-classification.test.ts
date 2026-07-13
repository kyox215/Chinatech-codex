import { describe, expect, it } from "vitest";

import { countOrderQueueGroups, getOrderQueueGroup } from "./order-queue-classification";

describe("order queue classification", () => {
  it.each([
    ["parts_arrived", "parts", "arrived"],
    ["mail_in_progress", "repair", "processing"],
    ["parts_ordered", "parts", "ordered"],
    ["repaired", "repair", "repaired"],
    ["notified", "pickup", "repaired_notified"],
    ["waiting_pickup", "pickup", "repaired_notified"],
    ["unfixed_pickup", "pickup", "processing"],
  ] as const)("classifies %s as %s work", (status, workflow_status, expected) => {
    expect(
      getOrderQueueGroup({
        status,
        workflow_status,
      }),
    ).toBe(expected);
  });

  it("splits arrival and repair notification states without changing the repair stage", () => {
    expect(
      getOrderQueueGroup({
        status: "parts_arrived",
        workflow_status: "parts",
        parts_status: "arrived",
        notify_status: "not_sent",
      }),
    ).toBe("arrived");
    expect(
      getOrderQueueGroup({
        status: "parts_arrived",
        workflow_status: "parts",
        parts_status: "arrived",
        notify_status: "sent",
      }),
    ).toBe("arrived_notified");
    expect(
      getOrderQueueGroup({ status: "repaired", workflow_status: "repair", notify_status: "sent" }),
    ).toBe("repaired_notified");
  });

  it.each(["rework", "mail_in_progress", "unfixed_pickup"])(
    "keeps explicit non-repaired status %s in processing when workflow data is stale",
    (status) => {
      expect(getOrderQueueGroup({ status, workflow_status: "pickup", notify_status: "sent" })).toBe(
        "processing",
      );
    },
  );

  it("produces one operational group per active order", () => {
    const counts = countOrderQueueGroups([
      {
        status: "parts_ordered",
        workflow_status: "parts",
        parts_status: "ordered",
      },
      {
        status: "parts_arrived",
        workflow_status: "parts",
        parts_status: "arrived",
        notify_status: "sent",
      },
      {
        status: "repaired",
        workflow_status: "repair",
        notify_status: "not_sent",
      },
      {
        status: "completed",
        workflow_status: "closed",
      },
      {
        status: "cancelled",
        workflow_status: "closed",
      },
    ]);

    expect(counts).toEqual({
      all: 3,
      processing: 0,
      ordered: 1,
      arrived: 0,
      arrived_notified: 1,
      repaired: 1,
      repaired_notified: 0,
    });
  });
});
