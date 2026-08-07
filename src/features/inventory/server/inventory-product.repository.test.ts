import { describe, expect, it } from "vitest";

import type { AuditActor, InventoryListItem } from "@/lib/repairdesk/types";

import {
  isProductInventoryItem,
  mapProductStatus,
  projectInventoryProductDetail,
  projectInventoryProductListItem,
} from "./inventory-product.repository";

const actor = { id: "owner", storeId: "store", role: "owner" } as AuditActor;

const item: InventoryListItem = {
  id: "item-1",
  public_no: "I001234",
  status: "ready_for_sale",
  source_type: "manual_stock",
  category: "phone",
  brand: "Apple",
  model: "iPhone 13",
  color: "蓝色",
  serial_or_imei: "123456789012345",
  imei_check_status: "unknown",
  activation_lock_status: "unchecked",
  data_wipe_status: "unchecked",
  cosmetic_grade: "unknown",
  functional_grade: "untested",
  buyback_price: 260,
  list_price: 420,
  sale_price: 0,
  deposit_amount: 0,
  repair_cost_amount: 0,
  fees_amount: 0,
  currency_code: "EUR",
  warranty_months: 0,
  legacy_payload: {
    inventory_product_quick_create: true,
    internal_sku: "I001234",
    cost_provided: true,
    list_price_provided: true,
    warranty_provided: false,
    location: "A-02",
  },
  created_at: "2026-07-29T10:00:00.000Z",
  updated_at: "2026-07-29T10:00:00.000Z",
  item_label: "Apple iPhone 13",
  profit: 0,
};

describe("inventory product projection", () => {
  it("excludes buyback records from the product domain", () => {
    expect(isProductInventoryItem(item)).toBe(true);
    expect(isProductInventoryItem({ ...item, source_type: "buyback" })).toBe(false);
  });

  it("projects only product list fields and masks identifiers", () => {
    expect(projectInventoryProductListItem(item)).toEqual({
      id: "item-1",
      sku: "I001234",
      category: "phone",
      brand: "Apple",
      model: "iPhone 13",
      color: "蓝色",
      specification: "蓝色",
      masked_identifier: "•••• 2345",
      status: "in_stock",
      location: "A-02",
      list_price: 420,
      currency_code: "EUR",
      updated_at: "2026-07-29T10:00:00.000Z",
    });
  });

  it("omits unknown amounts and unauthorized cost", () => {
    const unknown = {
      ...item,
      list_price: 0,
      buyback_price: 0,
      legacy_payload: {
        ...item.legacy_payload,
        list_price_provided: false,
        cost_provided: false,
      },
    };
    expect(projectInventoryProductListItem(unknown)).not.toHaveProperty("list_price");
    expect(projectInventoryProductDetail(unknown, { ...actor, role: "sales" })).not.toHaveProperty(
      "cost_amount",
    );
  });

  it("projects a known cost only for actors with an effective finance capability", () => {
    const ownerDetail = projectInventoryProductDetail(item, actor);
    expect(ownerDetail.cost_amount).toBe(260);
    expect(ownerDetail.finance_redacted).toBeUndefined();

    for (const role of ["manager", "technician", "sales"] as const) {
      const restricted = projectInventoryProductDetail(item, { ...actor, role });
      expect(restricted).not.toHaveProperty("cost_amount");
      expect(restricted.finance_redacted).toBe(true);
    }

    const grantedManager = projectInventoryProductDetail(item, {
      ...actor,
      role: "manager",
      permissionGrants: ["finance:profit_read"],
    });
    expect(grantedManager.cost_amount).toBe(260);
    expect(grantedManager.finance_redacted).toBeUndefined();
  });

  it("maps legacy statuses into the small product display state", () => {
    expect(mapProductStatus("listed")).toBe("in_stock");
    expect(mapProductStatus("reserved")).toBe("reserved");
    expect(mapProductStatus("sold")).toBe("sold");
    expect(mapProductStatus("returned")).toBe("returned");
    expect(mapProductStatus("recycled")).toBe("removed");
  });

  it.each([
    ["手机", "phone"],
    ["平板电脑", "tablet"],
    ["电脑", "computer"],
    ["游戏机", "game_console"],
  ] as const)("canonicalizes legacy category %s", (category, expected) => {
    expect(projectInventoryProductListItem({ ...item, category }).category).toBe(expected);
  });
});
