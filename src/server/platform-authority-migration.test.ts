import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260720231500_platform_owner_single_authority.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("platform owner single-authority migration", () => {
  it("requires exactly one active verified canonical owner before DDL", () => {
    expect(sql).toContain("v_active_total <> 1 or v_valid_owner <> 1");
    expect(sql).toContain("lower(trim(u.email)) = 'kyox120@gmail.com'");
    expect(sql).toContain("u.email_confirmed_at is not null");
    expect(sql).toContain("require exactly one active verified canonical owner");
  });

  it("stops on invalid historical platform decisions", () => {
    expect(sql).toContain("v_invalid_platform_decisions <> 0");
    expect(sql).toContain("invalid historical platform decisions require review");
  });

  it("requires the active row to match the verified canonical auth identity", () => {
    expect(sql).toContain("platform_admins_single_active_owner_email");
    expect(sql).toContain("status <> 'active' or email = 'kyox120@gmail.com'");
    expect(sql).toContain("join auth.users u on u.id = pa.user_id");
    expect(sql).toContain("u.email_confirmed_at is not null");
  });

  it("guards every resulting platform-scoped decision and keeps trigger functions private", () => {
    expect(sql).toContain("new.review_scope = 'platform'");
    expect(sql).toContain("new.status in ('approved', 'rejected') then");
    expect(sql).not.toContain("v_decision_changed");
    expect(sql).toContain("onboarding_requests_enforce_platform_decision_owner");
    expect(sql).toContain(
      "revoke all on function public.repairdesk_enforce_platform_decision_owner()",
    );
  });

  it("uses bounded locks and refuses to replace same-named security objects", () => {
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '60s'");
    expect(sql).not.toContain("create or replace function");
    expect(sql).not.toContain("drop trigger if exists");
    expect(sql).not.toContain("drop constraint if exists");
  });
});
