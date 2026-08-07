import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260807120100_inventory_product_lifecycle_enable.sql",
  ),
  "utf8",
);

describe("inventory lifecycle enable migration", () => {
  it("runs object, RLS, ACL and function security preflight before granting execute", () => {
    const preflight = migration.indexOf("inventory lifecycle enable preflight failed");
    const grant = migration.indexOf("grant execute on function");
    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(preflight);
    expect(migration).toContain("relrowsecurity");
    expect(migration).toContain("has_table_privilege('anon'");
    expect(migration).toContain(
      "has_table_privilege('service_role', 'public.' || v_table, 'INSERT')",
    );
    expect(migration).toContain("has_function_privilege('service_role'");
    expect(migration).toContain("p.prosecdef");
    expect(migration).toContain("search_path=");
    expect(migration).toContain('search_path=""');
  });

  it("requires the active after-sales partial uniqueness contract", () => {
    expect(migration).toContain("inventory_after_sales_cases active order partial unique");
    expect(migration).toContain("status.*closed");
  });
});
