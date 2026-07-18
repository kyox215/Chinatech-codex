import { afterEach, describe, expect, it } from "vitest";

import { canAllocatePartsCosts } from "./procurement-feature";

afterEach(() => {
  delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  delete process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

describe("parts procurement feature gate", () => {
  const manager = (permissionGrants: Array<"inventory:cost_allocate" | "finance:cost_manage">) => ({
    displayName: "Manager",
    storeId: "store-1",
    storeRole: "manager" as const,
    permissionGrants,
  });

  it("requires both exact feature flags and the allocation grant", () => {
    const allocator = manager(["inventory:cost_allocate"]);
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED = "true";
    expect(canAllocatePartsCosts(allocator)).toBe(false);
    process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED = "1";
    expect(canAllocatePartsCosts(allocator)).toBe(true);
  });

  it("does not treat manual cost management as allocation permission", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED = "1";
    expect(canAllocatePartsCosts(manager(["finance:cost_manage"]))).toBe(false);
  });

  it("limits the system actor bypass to the explicit E2E mode", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_PARTS_PROCUREMENT_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canAllocatePartsCosts({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canAllocatePartsCosts({ displayName: "System", isSystem: true })).toBe(false);
  });
});
