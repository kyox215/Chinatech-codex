import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ORDER_LIST_LEGACY_SELECT,
  ORDER_LIST_SELECT,
  ORDER_SELECT,
  REPAIR_ORDER_CUSTOMER_EMBED,
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
    for (const select of [ORDER_SELECT, ORDER_LIST_SELECT, ORDER_LIST_LEGACY_SELECT]) {
      expect(select).toContain("supplier:suppliers!repair_orders_supplier_id_fkey(*)");
      expect(select).not.toContain("supplier:suppliers(*)");
    }
  });

  it("does not use ambiguous customer embeds in order server queries", () => {
    for (const file of [
      "src/server/repairdesk-shared.ts",
      "src/features/orders/server/order.repository.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/customer:customers\(/);
    }
  });
});
