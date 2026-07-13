import { describe, expect, it } from "vitest";

import {
  findCurrentOrderStatusChangedAt,
  formatOrderListDate,
  formatOrderRelativeDate,
} from "./order-date";

describe("order date presentation", () => {
  it("formats order dates in the Europe/Rome calendar", () => {
    expect(formatOrderListDate("2026-07-12T22:30:00.000Z")).toBe("13/07/2026");
  });

  it("formats a stable relative age", () => {
    expect(
      formatOrderRelativeDate("2026-07-13T08:00:00.000Z", new Date("2026-07-13T10:15:00.000Z")),
    ).toBe("2 小时前");
  });

  it("uses the latest matching status event and falls back to creation time", () => {
    const changedAt = findCurrentOrderStatusChangedAt({
      status: "parts_arrived",
      createdAt: "2026-07-10T08:00:00.000Z",
      events: [
        {
          id: "event-1",
          order_id: "order-1",
          event_type: "status_changed",
          payload: { from: "parts_ordered", to: "parts_arrived" },
          operator_name: "ALESSIO",
          created_at: "2026-07-12T09:30:00.000Z",
        },
      ],
    });

    expect(changedAt).toBe("2026-07-12T09:30:00.000Z");
    expect(
      findCurrentOrderStatusChangedAt({
        status: "new",
        createdAt: "2026-07-10T08:00:00.000Z",
        events: [],
      }),
    ).toBe("2026-07-10T08:00:00.000Z");
  });

  it("ignores same-state confirmations and unrelated status events", () => {
    expect(
      findCurrentOrderStatusChangedAt({
        status: "cancelled",
        createdAt: "2026-07-10T08:00:00.000Z",
        events: [
          {
            id: "event-confirmation",
            order_id: "order-1",
            event_type: "status_changed",
            payload: { from: "cancelled", to: "cancelled" },
            operator_name: "ALESSIO",
            created_at: "2026-07-13T09:30:00.000Z",
          },
          {
            id: "event-cancelled",
            order_id: "order-1",
            event_type: "status_changed",
            payload: { from: "diagnosing", to: "cancelled" },
            operator_name: "ALESSIO",
            created_at: "2026-07-12T09:30:00.000Z",
          },
        ],
      }),
    ).toBe("2026-07-12T09:30:00.000Z");

    expect(
      findCurrentOrderStatusChangedAt({
        status: "parts_arrived",
        createdAt: "2026-07-10T08:00:00.000Z",
        events: [
          {
            id: "event-unrelated",
            order_id: "order-1",
            event_type: "status_changed",
            payload: { from: "new", to: "diagnosing" },
            operator_name: "ALESSIO",
            created_at: "2026-07-11T09:30:00.000Z",
          },
        ],
      }),
    ).toBe("2026-07-10T08:00:00.000Z");
  });
});
