import { describe, expect, it } from "vitest";

import {
  ORDER_LIST_LEGACY_SELECT,
  ORDER_LIST_SELECT,
  ORDER_SELECT,
} from "@/server/repairdesk-shared";

describe("repairdesk shared Supabase selects", () => {
  it("uses an explicit supplier relationship for repair order embeds", () => {
    for (const select of [ORDER_SELECT, ORDER_LIST_SELECT, ORDER_LIST_LEGACY_SELECT]) {
      expect(select).toContain("supplier:suppliers!repair_orders_supplier_id_fkey(*)");
      expect(select).not.toContain("supplier:suppliers(*)");
    }
  });
});
