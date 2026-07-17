import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260717220219_employee_invite_email_delivery.sql"),
  "utf8",
);
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717223030_employee_invite_lifecycle_lint_hardening.sql",
  ),
  "utf8",
);
const runtimeLookupMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717223222_employee_invite_runtime_lifecycle_lookup.sql",
  ),
  "utf8",
);
const conflictConstraintMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260717223354_employee_invite_membership_conflict_constraint.sql",
  ),
  "utf8",
);

describe("employee invitation delivery migration", () => {
  it("adds bounded delivery state without persisting an Auth bearer token", () => {
    expect(migration).toContain("email_delivery_status text not null default 'not_requested'");
    expect(migration).toContain("email_delivery_generation bigint not null default 0");
    expect(migration).toContain("last_email_delivery_error_code text");
    expect(migration).not.toMatch(/auth_(?:token|otp)|confirmation_(?:token|hash)/i);
  });

  it("accepts an invitation atomically under the store lifecycle lock", () => {
    expect(migration).toContain(
      "create or replace function public.repairdesk_accept_store_invitation_rpc",
    );
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("for update");
    expect(migration).toContain("STORE_INVITATION_IDENTITY_MISMATCH");
    expect(migration).toContain("STORE_INVITATION_STORE_INACTIVE");
    expect(migration).toContain("on conflict on constraint store_memberships_store_user_unique");
    expect(migration).toContain("insert into public.audit_logs");
  });

  it("exposes the acceptance RPC only to the service role", () => {
    expect(migration).toContain(
      "revoke all on function public.repairdesk_accept_store_invitation_rpc",
    );
    expect(migration).toContain(
      "grant execute on function public.repairdesk_accept_store_invitation_rpc",
    );
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(/grant execute[\s\S]*to (?:anon|authenticated)/i);
  });

  it("uses a lint-safe dynamic lifecycle lookup in both replay and forward hardening", () => {
    for (const sql of [
      migration,
      hardeningMigration,
      runtimeLookupMigration,
      conflictConstraintMigration,
    ]) {
      expect(sql).toContain("pg_catalog.to_regclass('public.store_lifecycles')");
      expect(sql).toContain("execute pg_catalog.format(");
      expect(sql).not.toContain("select 1 from public.store_lifecycles");
      expect(sql).toContain("v_lifecycle_relation regclass");
    }
  });
});
