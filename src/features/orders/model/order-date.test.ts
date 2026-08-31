import { describe, expect, it } from "vitest";

import {
  findCurrentOrderStatusChangedAt,
  formatOrderListDate,
  formatOrderRelativeDate,
} from "./order-date";

describe("order date presentation", () => {
  it("formats order dates in the Europe/Rome calendar", () => {
    const value = "2026-07-12T22:30:00.000Z";
    expect(formatOrderListDate(value, "zh-CN")).toBe("2026/07/13");
    expect(formatOrderListDate(value, "it-IT")).toBe("13/07/2026");
    expect(formatOrderListDate(value, "en")).toBe("07/13/2026");
  });

  it("formats a stable relative age", () => {
    const value = "2026-07-13T08:00:00.000Z";
    const now = new Date("2026-07-13T10:15:00.000Z");
    expect(formatOrderRelativeDate(value, now, "zh-CN")).toBe("2 小时前");
    expect(formatOrderRelativeDate(value, now, "it-IT")).toBe("2 ore fa");
    expect(formatOrderRelativeDate(value, now, "en")).toBe("2 hr ago");
  });

  it.each([
    ["hour", "2026-07-13T09:00:00.000Z", "1 小时前", "1 ora fa", "1 hr ago"],
    ["day", "2026-07-12T10:00:00.000Z", "1 天前", "1 giorno fa", "1 day ago"],
    ["month", "2026-06-13T10:00:00.000Z", "1 个月前", "1 mese fa", "1 month ago"],
    ["year", "2025-07-13T10:00:00.000Z", "1 年前", "1 anno fa", "1 year ago"],
  ] as const)("uses singular %s relative copy", (_unit, value, zh, it, en) => {
    const now = new Date("2026-07-13T10:00:00.000Z");
    expect(formatOrderRelativeDate(value, now, "zh-CN")).toBe(zh);
    expect(formatOrderRelativeDate(value, now, "it-IT")).toBe(it);
    expect(formatOrderRelativeDate(value, now, "en")).toBe(en);
  });

  it.each(["zh-CN", "it-IT", "en"] as const)("localizes invalid date fallback: %s", (locale) => {
    const list = formatOrderListDate("not-a-date", locale);
    const relative = formatOrderRelativeDate(
      "not-a-date",
      new Date("2026-07-13T10:15:00.000Z"),
      locale,
    );
    expect(list).toBeTruthy();
    expect(relative).toBeTruthy();
    if (locale !== "zh-CN") expect(`${list}${relative}`).not.toMatch(/[一-龥]/);
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
