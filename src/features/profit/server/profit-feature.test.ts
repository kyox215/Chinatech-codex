import { afterEach, describe, expect, it } from "vitest";

import { canReadProfitCenter } from "./profit-feature";

afterEach(() => {
  delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  delete process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

describe("profit center feature gate", () => {
  const manager = (permissionGrants: Array<"finance:profit_read" | "finance:cost_manage">) => ({
    displayName: "Manager",
    storeId: "store-1",
    storeRole: "manager" as const,
    permissionGrants,
  });

  it("requires both exact flags and the profit-read grant", () => {
    const reader = manager(["finance:profit_read"]);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED = "true";
    expect(canReadProfitCenter(reader)).toBe(false);
    process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED = "1";
    expect(canReadProfitCenter(reader)).toBe(true);
  });

  it("does not treat cost management as profit-report permission", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED = "1";
    expect(canReadProfitCenter(manager(["finance:cost_manage"]))).toBe(false);
  });

  it("allows the system actor only in the explicit non-production E2E bypass", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canReadProfitCenter({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canReadProfitCenter({ displayName: "System", isSystem: true })).toBe(false);
  });
});
