import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260713144316_kiosk_integrity_expand.sql",
  "utf8",
).toLowerCase();

const expectedNotValidConstraints = [
  "customer_kiosk_sessions_device_same_store_fkey",
  "customer_kiosk_sessions_submission_version_nonnegative",
  "customer_kiosk_sessions_expiry_after_creation",
  "customer_kiosk_sessions_submission_state_shape",
  "customer_kiosk_sessions_accepted_state_shape",
  "customer_kiosk_sessions_returned_state_shape",
  "customer_kiosk_sessions_cancelled_state_shape",
  "store_kiosk_devices_token_hash_format",
  "store_kiosk_devices_pairing_hash_format",
  "store_kiosk_devices_pairing_state_shape",
  "store_kiosk_devices_active_state_shape",
  "store_kiosk_devices_revoked_state_shape",
] as const;

describe("kiosk integrity expand migration contract", () => {
  it("adds a same-store device reference without validating historical rows", () => {
    expect(migration).toContain("store_kiosk_devices_id_store_id_uidx");
    expect(migration).toContain("foreign key (device_id, store_id)");
    expect(migration).toContain("references public.store_kiosk_devices (id, store_id)");
    expect(migration).toContain("on update cascade");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("customer_kiosk_sessions_device_store_idx");
    expect(migration.match(/not valid;/g)?.length ?? 0).toBe(expectedNotValidConstraints.length);
    for (const constraint of expectedNotValidConstraints) {
      const start = migration.indexOf(`add constraint ${constraint}`);
      const end = migration.indexOf("\nalter table", start + 1);
      expect(start, `${constraint} must exist`).toBeGreaterThanOrEqual(0);
      expect(migration.slice(start, end < 0 ? migration.length : end)).toContain("not valid;");
    }
  });

  it("protects version, expiry, session state, and device credential shapes", () => {
    expect(migration).toContain("check (submission_version >= 0)");
    expect(migration).toContain("check (expires_at > created_at)");
    expect(migration).toContain("customer_kiosk_sessions_submission_state_shape");
    expect(migration).toContain("customer_kiosk_sessions_accepted_state_shape");
    expect(migration).toContain("customer_kiosk_sessions_returned_state_shape");
    expect(migration).toContain("customer_kiosk_sessions_cancelled_state_shape");
    expect(migration).toContain("store_kiosk_devices_token_hash_format");
    expect(migration).toContain("store_kiosk_devices_pairing_hash_format");
    expect(migration).toContain("store_kiosk_devices_pairing_state_shape");
    expect(migration).toContain("store_kiosk_devices_active_state_shape");
    expect(migration).toContain("store_kiosk_devices_revoked_state_shape");
  });

  it("defers unresolved order and customer physical-type constraints", () => {
    expect(migration).not.toContain("foreign key (order_id, store_id)");
    expect(migration).not.toContain("foreign key (customer_id, store_id)");
    expect(migration).toContain("read-only format_type preflight");
  });

  it("contains no destructive schema or historical-data rewrite", () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|constraint|function|type)\b/);
    expect(migration).not.toMatch(/(?:^|\n)\s*(delete|update|truncate)\s+/m);
    expect(migration).not.toContain("validate constraint");
    expect(migration).not.toContain("if not exists");
  });

  it("fails boundedly on lock contention or unexpectedly long DDL", () => {
    expect(migration).toContain("set lock_timeout = '5s'");
    expect(migration).toContain("set statement_timeout = '2min'");
    expect(migration).toContain("reset statement_timeout");
    expect(migration).toContain("reset lock_timeout");
  });
});
