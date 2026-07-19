import { describe, expect, it } from "vitest";

import { resolveOrderDateFilter } from "./order-query-date";

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
});
