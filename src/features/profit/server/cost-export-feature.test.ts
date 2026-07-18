import { afterEach, describe, expect, it } from "vitest";

import { canExportCosts } from "./cost-export-feature";

afterEach(() => {
  delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  delete process.env.REPAIRDESK_COST_EXPORT_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

describe("cost export feature gate", () => {
  const manager = (permissionGrants: Array<"finance:profit_read" | "finance:cost_export">) => ({
    displayName: "Manager",
    storeId: "store-1",
    storeRole: "manager" as const,
    permissionGrants,
  });

  it("requires the parent flag, exact child flag, and exact export grant", () => {
    const exporter = manager(["finance:profit_read", "finance:cost_export"]);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    expect(canExportCosts(exporter)).toBe(false);
    process.env.REPAIRDESK_COST_EXPORT_ENABLED = "1";
    expect(canExportCosts(exporter)).toBe(true);
    expect(canExportCosts(manager(["finance:profit_read"]))).toBe(false);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "0";
    expect(canExportCosts(exporter)).toBe(false);
  });

  it("does not accept forged grants on lower roles", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_EXPORT_ENABLED = "1";
    expect(
      canExportCosts({
        displayName: "Technician",
        storeId: "store-1",
        storeRole: "technician",
        permissionGrants: ["finance:cost_export"],
      }),
    ).toBe(false);
  });

  it("allows the system actor only under the exact non-production E2E bypass", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_EXPORT_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canExportCosts({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canExportCosts({ displayName: "System", isSystem: true })).toBe(false);
  });
});
