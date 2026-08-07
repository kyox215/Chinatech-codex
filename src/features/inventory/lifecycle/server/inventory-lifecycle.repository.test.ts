import { describe, expect, it } from "vitest";

import type { AuditActor, StoreRole } from "@/lib/repairdesk/types";

import { resolveInventoryLifecycleAllowedActions } from "./inventory-lifecycle.repository";

function actor(role: StoreRole): AuditActor {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    email: "staff@example.test",
    displayName: "Staff",
    storeId: "00000000-0000-4000-8000-000000000002",
    storeName: "Test Store",
    role,
    storeRole: role,
  };
}

describe("inventory lifecycle allowed action projection", () => {
  it("projects intake, inspection and reservation only for an in-stock item", () => {
    expect(
      resolveInventoryLifecycleAllowedActions(actor("owner"), {
        businessStatus: "in_stock",
        balance: 0,
        hasActiveCase: false,
      }),
    ).toEqual(
      expect.arrayContaining(["acquisition.save", "inspection.save", "reservation.create"]),
    );
  });

  it("requires an exact paid balance before exposing sale completion", () => {
    const unpaid = resolveInventoryLifecycleAllowedActions(actor("owner"), {
      businessStatus: "reserved",
      orderStatus: "reserved",
      balance: 20,
      hasActiveCase: false,
    });
    const paid = resolveInventoryLifecycleAllowedActions(actor("owner"), {
      businessStatus: "reserved",
      orderStatus: "reserved",
      balance: 0,
      hasActiveCase: false,
    });
    expect(unpaid).toContain("payment.append");
    expect(unpaid).not.toContain("sale.complete");
    expect(paid).toContain("sale.complete");
  });

  it("does not infer mutation capabilities for a viewer", () => {
    expect(
      resolveInventoryLifecycleAllowedActions(actor("viewer"), {
        businessStatus: "delivered",
        orderStatus: "sold",
        balance: 0,
        hasActiveCase: false,
      }),
    ).toEqual([]);
  });

  it("keeps after-sales actions independent from the original sale", () => {
    const delivered = resolveInventoryLifecycleAllowedActions(actor("manager"), {
      businessStatus: "delivered",
      orderStatus: "sold",
      balance: 0,
      hasActiveCase: false,
    });
    const activeCase = resolveInventoryLifecycleAllowedActions(actor("manager"), {
      businessStatus: "after_sales",
      orderStatus: "sold",
      balance: 0,
      hasActiveCase: true,
    });
    expect(delivered).toEqual(expect.arrayContaining(["warranty.adjust", "after_sales.create"]));
    expect(activeCase).toEqual(expect.arrayContaining(["after_sales.update", "after_sales.close"]));
    expect(activeCase).not.toContain("after_sales.create");
  });
});
