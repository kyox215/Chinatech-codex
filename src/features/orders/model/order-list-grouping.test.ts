import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/lib/repairdesk/types";
import {
  compareOrdersForQueue,
  countOrderResultGroups,
  getOrderResultGroup,
  groupOrderListItems,
} from "./order-list-grouping";

function order(
  id: string,
  status: OrderListItem["status"],
  createdAt: string,
  overrides: Partial<OrderListItem> = {},
) {
  return {
    id,
    public_no: `R-${id}`,
    status,
    created_at: createdAt,
    workflow_status: status === "completed" || status === "cancelled" ? "closed" : "intake",
    ...overrides,
  } as OrderListItem;
}

describe("order list grouping", () => {
  it("keeps operational stages before completed and cancelled history", () => {
    const rows = [
      order("cancelled", "cancelled", "2026-01-01T10:00:00Z"),
      order("repaired", "repaired", "2026-01-01T10:00:00Z", {
        workflow_status: "repair",
      }),
      order("ordered", "parts_ordered", "2026-01-01T10:00:00Z", {
        workflow_status: "parts",
      }),
      order("completed", "completed", "2026-01-01T10:00:00Z"),
    ].sort(compareOrdersForQueue);

    expect(rows.map((row) => getOrderResultGroup(row))).toEqual([
      "ordered",
      "repaired",
      "completed",
      "cancelled",
    ]);
  });

  it("sorts each status group by created date from oldest to newest", () => {
    const newer = order("newer", "new", "2026-05-02T10:00:00Z");
    const older = order("older", "new", "2026-05-01T10:00:00Z");

    expect([newer, older].sort(compareOrdersForQueue).map((row) => row.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("returns only non-empty groups and counts terminal results separately", () => {
    const rows = [
      order("active", "new", "2026-05-01T10:00:00Z"),
      order("done", "completed", "2026-05-02T10:00:00Z"),
      order("void", "cancelled", "2026-05-03T10:00:00Z"),
    ];

    expect(groupOrderListItems(rows).map((section) => section.group)).toEqual([
      "processing",
      "completed",
      "cancelled",
    ]);
    expect(countOrderResultGroups(rows)).toMatchObject({
      processing: 1,
      completed: 1,
      cancelled: 1,
    });
  });

  it("groups exception-only cancellation history as cancelled", () => {
    const legacy = order("legacy-cancel", "repairing", "2026-05-03T10:00:00Z", {
      workflow_status: "repair",
      exception_status: "cancelled",
    });

    expect(getOrderResultGroup(legacy)).toBe("cancelled");
    expect(countOrderResultGroups([legacy])).toMatchObject({ completed: 0, cancelled: 1 });
  });

  it("keeps all eight result groups in their fixed business order", () => {
    const rows = [
      order("cancelled", "cancelled", "2026-05-01T10:00:00Z"),
      order("completed", "completed", "2026-05-01T10:00:00Z"),
      order("repaired-notified", "repaired", "2026-05-01T10:00:00Z", {
        notify_status: "sent",
      }),
      order("repaired", "repaired", "2026-05-01T10:00:00Z"),
      order("arrived-notified", "parts_arrived", "2026-05-01T10:00:00Z", {
        notify_status: "sent",
      }),
      order("arrived", "parts_arrived", "2026-05-01T10:00:00Z"),
      order("ordered", "parts_ordered", "2026-05-01T10:00:00Z"),
      order("processing", "diagnosing", "2026-05-01T10:00:00Z"),
    ];

    expect(groupOrderListItems(rows).map((section) => section.group)).toEqual([
      "processing",
      "ordered",
      "arrived",
      "arrived_notified",
      "repaired",
      "repaired_notified",
      "completed",
      "cancelled",
    ]);
  });

  it("uses public number and id as stable ties after group and date", () => {
    const rows = [
      order("b", "diagnosing", "2026-05-01T10:00:00Z", { public_no: "R-10" }),
      order("c", "diagnosing", "2026-05-01T10:00:00Z", { public_no: "R-2" }),
      order("a", "diagnosing", "2026-05-01T10:00:00Z", { public_no: "R-10" }),
    ];

    expect(rows.sort(compareOrdersForQueue).map((row) => row.id)).toEqual(["c", "a", "b"]);
  });
});
