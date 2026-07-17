import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const baseMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717185048_store_settings_public_base_url.sql"),
  "utf8",
);

const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717212000_store_settings_public_base_url_constraint_hardening.sql",
  ),
  "utf8",
);

describe("store public base URL migration replay chain", () => {
  it("keeps the applied base migration complete and distinct from its forward hardening", () => {
    expect(baseMigration).not.toBe(hardeningMigration);
    expect(baseMigration).toContain(
      "create or replace function public.repairdesk_rollback_order_data_batch_v1",
    );
    expect(baseMigration).toContain("where id::text = v_before_customer ->> 'id'");
    expect(baseMigration).toContain("where id::text = v_before_device ->> 'id'");
    expect(baseMigration).toContain("set search_path = ''");
    expect(baseMigration).toContain(
      "revoke all on function public.repairdesk_rollback_order_data_batch_v1",
    );
    expect(baseMigration).toContain(
      "grant execute on function public.repairdesk_rollback_order_data_batch_v1",
    );
  });

  it("uses a separate idempotent forward migration for the stricter URL constraint", () => {
    expect(hardeningMigration).toContain(
      "drop constraint if exists store_settings_public_base_url_check",
    );
    expect(hardeningMigration).toContain("length(public_base_url) <= 2048");
    expect(hardeningMigration).toContain("public_base_url !~ '[[:space:]@?#]'");
    expect(hardeningMigration).toContain(
      "validate constraint store_settings_public_base_url_check",
    );
    expect(hardeningMigration).not.toContain("repairdesk_rollback_order_data_batch_v1");
    expect(hardeningMigration).not.toMatch(/\b(?:insert|update|delete|truncate|drop table)\b/i);
  });
});
