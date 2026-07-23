import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORDER_LIST_CARD_SELECT,
  ORDER_LIST_INDEX_SELECT,
  ORDER_LIST_LEGACY_SELECT,
  ORDER_LIST_SELECT,
  ORDER_SELECT,
  REPAIR_ORDER_CUSTOMER_EMBED,
  REPAIR_ORDER_DEVICE_EMBED,
  REPAIR_ORDER_PARTS_SUPPLIER_EMBED,
  REPAIR_ORDER_SUPPLIER_EMBED,
  orderFromRow,
} from "@/server/repairdesk-shared";

describe("repairdesk shared Supabase selects", () => {
  it("uses an explicit same-store customer relationship for repair order embeds", () => {
    expect(REPAIR_ORDER_CUSTOMER_EMBED).toBe(
      "customer:customers!repair_orders_customer_same_store_fkey",
    );

    for (const select of [ORDER_SELECT, ORDER_LIST_SELECT, ORDER_LIST_LEGACY_SELECT]) {
      expect(select).toContain(`${REPAIR_ORDER_CUSTOMER_EMBED}(*)`);
      expect(select).not.toContain("customer:customers(*)");
      expect(select).not.toContain("customer:customers(");
    }
  });

  it("keeps queue index and card embeds narrow", () => {
    for (const select of [ORDER_LIST_INDEX_SELECT, ORDER_LIST_CARD_SELECT]) {
      expect(select).toContain(`${REPAIR_ORDER_CUSTOMER_EMBED}(id,name,phone_e164`);
      expect(select).toContain(`${REPAIR_ORDER_DEVICE_EMBED}(id,customer_id,brand,model`);
      expect(select).not.toContain(`${REPAIR_ORDER_CUSTOMER_EMBED}(*)`);
      expect(select).not.toContain(`${REPAIR_ORDER_DEVICE_EMBED}(*)`);
    }
    expect(ORDER_LIST_INDEX_SELECT).not.toContain(REPAIR_ORDER_SUPPLIER_EMBED);
    expect(ORDER_LIST_CARD_SELECT).toContain(`${REPAIR_ORDER_SUPPLIER_EMBED}(id,name`);
  });

  it("uses an explicit supplier relationship for repair order embeds", () => {
    expect(REPAIR_ORDER_SUPPLIER_EMBED).toBe(
      "supplier:suppliers!repair_orders_supplier_same_store_fkey",
    );

    for (const select of [ORDER_SELECT, ORDER_LIST_SELECT, ORDER_LIST_LEGACY_SELECT]) {
      expect(select).toContain(`${REPAIR_ORDER_SUPPLIER_EMBED}(*)`);
      expect(select).not.toContain("supplier:suppliers(*)");
      expect(select).not.toContain("supplier:suppliers!repair_orders_supplier_id_fkey(*)");
    }
  });

  it("uses explicit same-store device relationships for repair order embeds", () => {
    expect(REPAIR_ORDER_DEVICE_EMBED).toBe("device:devices!repair_orders_device_same_store_fkey");

    for (const select of [ORDER_SELECT, ORDER_LIST_SELECT, ORDER_LIST_LEGACY_SELECT]) {
      expect(select).toContain(`${REPAIR_ORDER_DEVICE_EMBED}(*)`);
      expect(select).not.toContain("device:devices(*)");
      expect(select).not.toContain("device:devices(");
    }
  });

  it("uses an explicit same-store parts supplier relationship for repair order embeds", () => {
    expect(REPAIR_ORDER_PARTS_SUPPLIER_EMBED).toBe(
      "parts_supplier:suppliers!repair_orders_parts_supplier_same_store_fkey",
    );
    expect(ORDER_SELECT).toContain(`${REPAIR_ORDER_PARTS_SUPPLIER_EMBED}(*)`);
  });

  it("does not use ambiguous repair order embeds in order server queries", () => {
    for (const file of [
      "src/server/repairdesk-shared.ts",
      "src/features/orders/server/order.repository.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/customer:customers\(/);
      expect(source).not.toMatch(/device:devices\(/);
      expect(source).not.toMatch(/supplier:suppliers\(/);
    }
  });

  it("preserves quote line and catalog identities when reading an order", () => {
    const parsed = orderFromRow({
      id: "order-1",
      status: "repairing",
      fault_prices: [
        {
          line_id: "00000000-0000-4000-8000-000000000201",
          catalog_key: "display:main",
          name: "屏幕",
          price: 80,
        },
      ],
    });

    expect(parsed.fault_prices).toEqual([
      {
        line_id: "00000000-0000-4000-8000-000000000201",
        catalog_key: "display:main",
        name: "屏幕",
        price: 80,
        currency_code: "EUR",
      },
    ]);
  });
});
