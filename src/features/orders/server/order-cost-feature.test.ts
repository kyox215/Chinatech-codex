import { afterEach, describe, expect, it } from "vitest";

import { canManageOrderCosts, canReadOrderCosts } from "./order-cost-feature";

const previousFlag = process.env.REPAIRDESK_ORDER_COSTS_ENABLED;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  else process.env.REPAIRDESK_ORDER_COSTS_ENABLED = previousFlag;
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
});
