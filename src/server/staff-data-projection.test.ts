import { describe, expect, it } from "vitest";

import { projectCustomerAggregateFinance } from "@/features/customers/server/customer.repository";
import {
  buildInventoryStats,
  projectInventoryItemForActor,
} from "@/features/inventory/server/inventory.repository";
import type {
  AuditActor,
  CustomerListItem,
  InventoryListItem,
  StoreRole,
} from "@/lib/repairdesk/types";

function actor(role: StoreRole, grants: AuditActor["permissionGrants"] = []): AuditActor {
  return {
    id: `staff_${role}`,
    displayName: role,
    role,
    storeRole: role,
    storeId: "store_1",
    permissionGrants: grants,
  };
}

const inventoryItem = {
  id: "item_1",
  status: "sold",
  buyback_price: 100,
  repair_cost_amount: 20,
  fees_amount: 5,
  list_price: 200,
  sale_price: 190,
  profit: 65,
  customer_phone: "+393330000000",
  legacy_payload: {
    buyback_quote: { expected_profit: 65, suggested_offer: 100, model: "iPhone 13" },
  },
} as unknown as InventoryListItem;

describe("staff financial data projections", () => {
  it("removes customer lifetime value and unpaid totals without an aggregate grant", () => {
    const customer = {
      id: "customer_1",
      total_spent: 900,
      unpaid_amount: 120,
    } as CustomerListItem;

    const projected = projectCustomerAggregateFinance(customer, actor("sales"));

    expect(Object.hasOwn(projected, "total_spent")).toBe(false);
    expect(Object.hasOwn(projected, "unpaid_amount")).toBe(false);
    expect(projected.finance_redacted).toBe(true);
  });

  it("restores customer aggregates only for owner or explicitly granted manager", () => {
    const customer = { total_spent: 900, unpaid_amount: 120 } as CustomerListItem;

    expect(projectCustomerAggregateFinance(customer, actor("owner")).total_spent).toBe(900);
    expect(
      projectCustomerAggregateFinance(customer, actor("manager", ["finance:aggregate_read"]))
        .total_spent,
    ).toBe(900);
  });

  it("removes inventory costs, profit, sensitive quote values, and technician contact data", () => {
    const projected = projectInventoryItemForActor(inventoryItem, actor("technician"));

    for (const field of ["buyback_price", "repair_cost_amount", "fees_amount", "profit"]) {
      expect(Object.hasOwn(projected, field)).toBe(false);
    }
    expect(projected.list_price).toBe(200);
    expect(projected.customer_phone).toBeUndefined();
    expect(projected.legacy_payload).toEqual({ buyback_quote: { model: "iPhone 13" } });
    expect(projected.finance_redacted).toBe(true);
  });

  it("returns no inventory aggregate money without grants and restores it for granted managers", () => {
    const hidden = buildInventoryStats([inventoryItem], actor("manager"));
    const visible = buildInventoryStats(
      [inventoryItem],
      actor("manager", ["finance:aggregate_read", "finance:profit_read"]),
    );

    expect(Object.hasOwn(hidden, "buybackCost")).toBe(false);
    expect(Object.hasOwn(hidden, "listedValue")).toBe(false);
    expect(Object.hasOwn(hidden, "realizedProfit")).toBe(false);
    expect(hidden.finance_redacted).toBe(true);
    expect(visible).toMatchObject({ buybackCost: 100, realizedProfit: 65 });
    expect(visible.finance_redacted).toBeUndefined();
  });
});
