import { afterEach, describe, expect, it } from "vitest";

import { canApplyCostBackfill, canPreviewCostBackfill } from "./cost-backfill-feature";

afterEach(() => {
  delete process.env.REPAIRDESK_ORDER_COSTS_ENABLED;
  delete process.env.REPAIRDESK_COST_BACKFILL_ENABLED;
  delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
});

describe("cost backfill feature gate", () => {
  it("requires the parent and exact child flag, with preview separate from apply", () => {
    const manager = {
      displayName: "Manager",
      storeId: "store-1",
      storeRole: "manager" as const,
      permissionGrants: ["finance:cost_backfill_preview" as const],
    };
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    expect(canPreviewCostBackfill(manager)).toBe(false);
    process.env.REPAIRDESK_COST_BACKFILL_ENABLED = "1";
    expect(canPreviewCostBackfill(manager)).toBe(true);
    expect(canApplyCostBackfill(manager)).toBe(false);
    expect(
      canApplyCostBackfill({
        displayName: "Owner",
        storeId: "store-1",
        storeRole: "owner",
      }),
    ).toBe(true);
  });

  it("does not accept forged preview or apply grants on lower roles", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_BACKFILL_ENABLED = "1";
    const forged = {
      displayName: "Technician",
      storeId: "store-1",
      storeRole: "technician" as const,
      permissionGrants: ["finance:cost_backfill_preview" as const],
    };
    expect(canPreviewCostBackfill(forged)).toBe(false);
    expect(canApplyCostBackfill(forged)).toBe(false);
  });

  it("allows the system actor only under the exact non-production E2E bypass", () => {
    process.env.REPAIRDESK_ORDER_COSTS_ENABLED = "1";
    process.env.REPAIRDESK_COST_BACKFILL_ENABLED = "1";
    process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP = "1";
    expect(canPreviewCostBackfill({ displayName: "System", isSystem: true })).toBe(true);
    expect(canApplyCostBackfill({ displayName: "System", isSystem: true })).toBe(true);
    delete process.env.REPAIRDESK_E2E_BUSINESS_DESKTOP;
    expect(canPreviewCostBackfill({ displayName: "System", isSystem: true })).toBe(false);
  });
});
