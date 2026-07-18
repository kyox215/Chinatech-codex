import { afterEach, describe, expect, it } from "vitest";

import type { AuditActor } from "@/lib/repairdesk/types";

import { canManageCostCurrencies, canReadCostCurrencies } from "./cost-currency-feature";

afterEach(() => {
  delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  delete process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

const actor = (
  role: AuditActor["storeRole"],
  permissionGrants: NonNullable<AuditActor["permissionGrants"]>,
): AuditActor => ({
  displayName: role ?? "staff",
  storeId: "store-1",
  storeRole: role,
  permissionGrants,
});

describe("cost currency feature gate", () => {
  it("requires both parent and exact child flags", () => {
    const owner = actor("owner", []);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED = "true";
    expect(canManageCostCurrencies(owner)).toBe(false);
    process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED = "1";
    expect(canManageCostCurrencies(owner)).toBe(true);
  });

  it("allows exact cost readers but keeps management owner-only", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED = "1";
    const manager = actor("manager", ["finance:cost_manage"]);
    const allocator = actor("manager", ["inventory:cost_allocate"]);
    const technician = actor("technician", ["inventory:cost_allocate"]);

    expect(canReadCostCurrencies(manager)).toBe(true);
    expect(canReadCostCurrencies(allocator)).toBe(true);
    expect(canManageCostCurrencies(manager)).toBe(false);
    expect(canManageCostCurrencies(actor("owner", []))).toBe(true);
    expect(canReadCostCurrencies(technician)).toBe(false);
  });

  it("limits the system bypass to explicit E2E mode", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_MULTI_CURRENCY_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canManageCostCurrencies({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canManageCostCurrencies({ displayName: "System", isSystem: true })).toBe(false);
  });
});
