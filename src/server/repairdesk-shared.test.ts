import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORDER_LIST_LEGACY_SELECT,
  ORDER_LIST_SELECT,
  ORDER_SELECT,
  REPAIR_ORDER_CUSTOMER_EMBED,
  REPAIR_ORDER_DEVICE_EMBED,
  REPAIR_ORDER_PARTS_SUPPLIER_EMBED,
  REPAIR_ORDER_SUPPLIER_EMBED,
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
});
