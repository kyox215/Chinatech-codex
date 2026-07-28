import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260728194940_store_settings_new_order_entry_mode.sql",
  "utf8",
);

describe("store settings new-order entry mode migration", () => {
  it("adds a constrained store-scoped professional default without widening grants", () => {
    expect(sql).toMatch(/add column new_order_entry_mode text not null default 'professional'/i);
    expect(sql).toMatch(/check \(new_order_entry_mode in \('simple', 'professional'\)\)/i);
    expect(sql).toMatch(/validate constraint store_settings_new_order_entry_mode_check/i);
    expect(sql).not.toMatch(/\bgrant\b/i);
    expect(sql).not.toMatch(/create\s+index/i);
  });
});
