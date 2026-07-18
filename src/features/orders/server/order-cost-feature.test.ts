import { afterEach, describe, expect, it } from "vitest";

import {
  canManageOrderCosts,
  canReadOrderCosts,
  isCostBackfillEnabled,
  isCostExportEnabled,
  isCostMultiCurrencyEnabled,
  isPartsProcurementEnabled,
  isProfitReportsEnabled,
} from "./order-cost-feature";

const previousFlag = process.env.REPAIRDESK_ORDER_COSTS_ENABLED;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  else process.env.REPAIRDESK_ORDER_COSTS_ENABLED = previousFlag;
  delete process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED;
  delete process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED;
  delete process.env.REPAIRDESK_COST_EXPORT_ENABLED;
  delete process.env.REPAIRDESK_COST_BACKFILL_ENABLED;
  delete process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

describe("order cost feature gate", () => {
  it("stays closed unless the exact server flag is enabled", () => {
    const owner = { displayName: "Owner", storeId: "store-1", storeRole: "owner" as const };
    delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
    expect(canManageOrderCosts(owner)).toBe(false);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "true";
    expect(canManageOrderCosts(owner)).toBe(false);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    expect(canManageOrderCosts(owner)).toBe(true);
  });

  it("allows profit readers to read but not manage costs", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    const manager = {
      displayName: "Manager",
      storeId: "store-1",
      storeRole: "manager" as const,
      permissionGrants: ["finance:profit_read" as const],
    };
    expect(canReadOrderCosts(manager)).toBe(true);
    expect(canManageOrderCosts(manager)).toBe(false);
  });

  it("ignores forged grants on roles that cannot receive them", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    const sales = {
      displayName: "Sales",
      storeId: "store-1",
      storeRole: "sales" as const,
      permissionGrants: ["finance:cost_manage" as const],
    };
    expect(canReadOrderCosts(sales)).toBe(false);
    expect(canManageOrderCosts(sales)).toBe(false);
  });

  it("allows the system actor only in the explicit non-production E2E bypass", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canReadOrderCosts({ displayName: "System", isSystem: true })).toBe(true);
    expect(canManageOrderCosts({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canReadOrderCosts({ displayName: "System", isSystem: true })).toBe(false);
    expect(canManageOrderCosts({ displayName: "System", isSystem: true })).toBe(false);
  });

  it("keeps every phase-two child capability fail-closed behind the phase-one flag", () => {
    process.env.REPAIRDESK_PROFIT_REPORTS_ENABLED = "1";
    process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED = "1";
    process.env.REPAIRDESK_COST_EXPORT_ENABLED = "1";
    process.env.REPAIRDESK_COST_BACKFILL_ENABLED = "1";
    process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED = "1";

    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "0";
    expect(isProfitReportsEnabled()).toBe(false);
    expect(isPartsProcurementEnabled()).toBe(false);
    expect(isCostExportEnabled()).toBe(false);
    expect(isCostBackfillEnabled()).toBe(false);
    expect(isCostMultiCurrencyEnabled()).toBe(false);

    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    expect(isProfitReportsEnabled()).toBe(true);
    expect(isPartsProcurementEnabled()).toBe(true);
    expect(isCostExportEnabled()).toBe(true);
    expect(isCostBackfillEnabled()).toBe(true);
    expect(isCostMultiCurrencyEnabled()).toBe(true);

    process.env.REPAIRDESK_COST_EXPORT_ENABLED = "true";
    expect(isCostExportEnabled()).toBe(false);
  });
});
