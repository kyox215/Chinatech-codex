import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const grantsMigration = readFileSync(
  "supabase/migrations/20260712002317_global_staff_permission_grants.sql",
  "utf8",
).toLowerCase();
const assignmentMigration = readFileSync(
  "supabase/migrations/20260712003452_global_order_assignment_scope.sql",
  "utf8",
).toLowerCase();
const assignmentHardeningMigration = readFileSync(
  "supabase/migrations/20260714004500_harden_legacy_order_assignment_backfill.sql",
  "utf8",
).toLowerCase();

describe("global staff permissions migration contract", () => {
  it("persists only the approved additive store grants", () => {
    for (const action of [
      "supplier:read",
      "supplier:assign",
      "supplier:manage",
      "order:archive_browse",
      "finance:aggregate_read",
      "finance:profit_read",
    ]) {
      expect(grantsMigration).toContain(`'${action}'`);
    }
  });

  it("changes member access and revokes old grants in one service-role RPC", () => {
    expect(grantsMigration).toContain(
      "create or replace function public.repairdesk_update_member_access_rpc",
    );
    expect(grantsMigration).toContain(
      "create or replace function public.repairdesk_replace_member_permission_grants_rpc",
    );
    expect(grantsMigration).toContain("for update");
    expect(grantsMigration).toContain("from unnest(v_actions) action");
    expect(grantsMigration).toContain("security definer");
    expect(grantsMigration).toContain("set search_path = ''");
    expect(grantsMigration).toContain("update public.store_memberships");
    expect(grantsMigration).toContain("update public.store_member_permission_grants");
    expect(grantsMigration).toContain("revoked_at = v_now");
    expect(grantsMigration).toContain("from public, anon, authenticated");
    expect(grantsMigration).toContain("to service_role");
  });

  it("adds same-store assignment and conservatively backfills legacy orders", () => {
    expect(assignmentMigration).toContain("add column if not exists assignee_membership_id uuid");
    expect(assignmentMigration).toContain("foreign key (assignee_membership_id, store_id)");
    expect(assignmentMigration).toContain("references public.store_memberships(id, store_id)");
    expect(assignmentMigration).toContain("with unique_name_matches as");
    expect(assignmentMigration).toContain("having count(*) = 1");
    expect(assignmentMigration).toContain("with unique_store_owners as");
    expect(assignmentMigration).toContain(
      "on public.repair_orders (store_id, assignee_membership_id, updated_at desc)",
    );
    expect(assignmentMigration).not.toMatch(/delete\s+from|truncate\s+/);
  });

  it("removes only untouched legacy backfill rows and fails closed after real assignment", () => {
    expect(assignmentHardeningMigration).toContain(
      "where migration_row.version = '20260712003452'",
    );
    expect(assignmentHardeningMigration).toContain("repair_order.xmin = v_backfill_xmin");
    expect(assignmentHardeningMigration).toContain("repair_order.xmin <> v_backfill_xmin");
    expect(assignmentHardeningMigration).toContain("v_later_assignment_count > 0");
    expect(assignmentHardeningMigration).toContain("set assignee_membership_id = null");
    expect(assignmentHardeningMigration).not.toMatch(/delete\s+from|truncate\s+|drop\s+column/);
  });
});
