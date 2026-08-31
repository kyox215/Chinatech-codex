import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from "@/shared/i18n/format";

describe("locale-aware display formatting", () => {
  it("preserves the project-wide leading euro symbol while localizing separators", () => {
    expect(formatCurrency(12345.5, "it-IT")).toBe("€12.345,50");
    expect(formatCurrency(12345.5, "en")).toBe("€12,345.50");
    expect(formatNumber(1234.5, "zh-CN")).toBe("1,234.5");
  });

  it("keeps the sign before the leading euro symbol and normalizes non-finite values", () => {
    expect(formatCurrency(-1234.5, "it-IT")).toBe("-€1234,50");
    expect(formatCurrency(-1234.5, "en")).toBe("-€1,234.50");
    expect(formatCurrency(Number.NaN, "en")).toBe("€0.00");
    expect(formatCurrency(Number.POSITIVE_INFINITY, "it-IT")).toBe("€0,00");
  });

  it("formats dates in the Europe/Rome time zone", () => {
    expect(
      formatDateTime("2026-01-15T12:00:00Z", "en", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    ).toBe("13:00");
  });

  it("requires a stable now value for relative time", () => {
    expect(formatRelativeTime("2026-01-15T11:00:00Z", "en", "2026-01-15T12:00:00Z")).toBe(
      "1 hour ago",
    );
  });
});
