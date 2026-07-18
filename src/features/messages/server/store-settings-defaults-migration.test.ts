import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260718183206_neutralize_store_settings_identity_defaults.sql",
  ),
  "utf8",
).toLowerCase();

describe("store settings identity defaults migration", () => {
  it("neutralizes every tenant identity default with a bounded lock", () => {
    expect(migration).toContain("set lock_timeout = '5s'");
    expect(migration).toContain("alter table public.store_settings");
    expect(migration).toContain("alter column store_name set default ''");
    expect(migration).toContain("alter column store_address set default ''");
    expect(migration).toContain("alter column print_footer set default ''");
    expect(migration).toContain("alter column message_signature set default ''");
    expect(migration).toContain("reset lock_timeout");
    expect(migration).not.toMatch(/if\s+exists|chinatech|floridia|viale vittorio veneto/i);
  });

  it("does not rewrite or delete existing tenant data", () => {
    expect(migration).not.toMatch(/\b(update|delete|insert|merge|copy|truncate|drop|do|execute)\b/);
  });
});
