import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isCostBackfillEnabled,
  isCostExportEnabled,
  isCostMultiCurrencyEnabled,
  isOrderCostsEnabled,
  isPartsProcurementEnabled,
  isProfitReportsEnabled,
} from "./order-cost-feature";

afterEach(() => vi.unstubAllEnvs());

describe("order cost child feature flags", () => {
  it("requires the retained parent flag for every finance/procurement child", () => {
    vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "0");
    vi.stubEnv("REPAIRDESK_PROFIT_REPORTS_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_PARTS_PROCUREMENT_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_EXPORT_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_BACKFILL_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_MULTI_CURRENCY_ENABLED", "1");

    expect(isOrderCostsEnabled()).toBe(false);
    expect(isProfitReportsEnabled()).toBe(false);
    expect(isPartsProcurementEnabled()).toBe(false);
    expect(isCostExportEnabled()).toBe(false);
    expect(isCostBackfillEnabled()).toBe(false);
    expect(isCostMultiCurrencyEnabled()).toBe(false);
  });

  it("keeps child tools independently enabled under the parent flag", () => {
    vi.stubEnv("REPAIRDESK_ORDER_COSTS_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_PROFIT_REPORTS_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_PARTS_PROCUREMENT_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_EXPORT_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_BACKFILL_ENABLED", "1");
    vi.stubEnv("REPAIRDESK_COST_MULTI_CURRENCY_ENABLED", "1");

    expect(isProfitReportsEnabled()).toBe(true);
    expect(isPartsProcurementEnabled()).toBe(true);
    expect(isCostExportEnabled()).toBe(true);
    expect(isCostBackfillEnabled()).toBe(true);
    expect(isCostMultiCurrencyEnabled()).toBe(true);
  });
});
