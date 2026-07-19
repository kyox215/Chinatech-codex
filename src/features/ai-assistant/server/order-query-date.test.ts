import { describe, expect, it } from "vitest";

import {
  hasUnresolvedOrderDateExpression,
  parseTrustedOrderDateFilter,
  redactValidatedOrderDateTokensForEgress,
  resolveOrderDateFilter,
} from "./order-query-date";

describe("order query calendar resolution", () => {
  it("resolves the previous complete Monday-to-Sunday week in Europe/Rome", () => {
    expect(
      resolveOrderDateFilter(
        { expression: "previous_calendar_week", field: "created_at" },
        new Date("2026-07-19T14:00:00.000Z"),
      ),
    ).toMatchObject({ from: "2026-07-06", to: "2026-07-12", periodLabel: "上周" });
  });

  it("uses the Rome calendar across the spring DST boundary", () => {
    expect(
      resolveOrderDateFilter(
        { expression: "previous_calendar_week", field: "completed_at" },
        new Date("2026-03-30T00:30:00.000Z"),
      ),
    ).toMatchObject({
      from: "2026-03-23",
      to: "2026-03-29",
      fieldLabel: "完成时间",
    });
  });

  it("resolves current month and year without asking the model for UTC", () => {
    const now = new Date("2026-01-01T00:30:00.000Z");
    expect(
      resolveOrderDateFilter({ expression: "current_calendar_month", field: "updated_at" }, now),
    ).toMatchObject({ from: "2026-01-01", to: "2026-01-31" });
    expect(
      resolveOrderDateFilter({ expression: "current_calendar_year", field: "created_at" }, now),
    ).toMatchObject({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("supports all time, arbitrary rolling periods, and absolute or open ranges", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");

    expect(
      resolveOrderDateFilter(
        parseTrustedOrderDateFilter("检查半年内所有的苹果15系列的手机", "created_at"),
        now,
      ),
    ).toMatchObject({
      expression: "rolling_period",
      amount: 6,
      unit: "month",
      from: "2026-01-19",
      to: "2026-07-19",
    });
    expect(
      resolveOrderDateFilter(
        parseTrustedOrderDateFilter("2024年2月1日到2025年11月30日的订单", "created_at"),
        now,
      ),
    ).toMatchObject({ from: "2024-02-01", to: "2025-11-30" });
    expect(
      resolveOrderDateFilter(
        parseTrustedOrderDateFilter("2023-06-30 之前的订单", "updated_at"),
        now,
      ),
    ).toMatchObject({ from: null, to: "2023-06-29", field: "updated_at" });
    expect(
      resolveOrderDateFilter(parseTrustedOrderDateFilter("全部日期的订单", "created_at"), now),
    ).toMatchObject({ expression: "all_time", from: null, to: null });
    expect(
      resolveOrderDateFilter(parseTrustedOrderDateFilter("六个月内的订单", "created_at"), now),
    ).toMatchObject({ amount: 6, unit: "month", from: "2026-01-19", to: "2026-07-19" });
    expect(parseTrustedOrderDateFilter("2024年2月到2025年3月的订单", "created_at")).toMatchObject({
      from: "2024-02-01",
      to: "2025-03-31",
    });
    expect(parseTrustedOrderDateFilter("2024年到2025年的订单", "created_at")).toMatchObject({
      from: "2024-01-01",
      to: "2025-12-31",
    });
    expect(parseTrustedOrderDateFilter("2025年第三季度的订单", "created_at")).toMatchObject({
      from: "2025-07-01",
      to: "2025-09-30",
    });
  });

  it("does not normalize invalid, reversed, excessive, or ambiguous dates into a broad query", () => {
    for (const message of [
      "苹果15 2026-02-30",
      "苹果15 2026-07-20 到 2026-07-01",
      "苹果15 01/02/2026",
      "苹果15 最近121个月",
      "苹果15 2026年13月",
      "苹果15 2026-13",
    ]) {
      expect(hasUnresolvedOrderDateExpression(message), message).toBe(true);
    }
    expect(hasUnresolvedOrderDateExpression("苹果15 最近120个月")).toBe(false);
  });

  it("redacts only validated calendar dates before provider egress", () => {
    expect(redactValidatedOrderDateTokensForEgress("苹果15 2026-07-19")).toBe("苹果15 [DATE]");
    expect(redactValidatedOrderDateTokensForEgress("苹果15 2026-02-30")).toContain("2026-02-30");
    expect(redactValidatedOrderDateTokensForEgress("电话 +39 333 1234567")).toContain(
      "+39 333 1234567",
    );
  });
});
