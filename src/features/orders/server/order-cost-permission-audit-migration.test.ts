import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260718121000_order_cost_permission_audit_atomic.sql",
  ),
  "utf8",
).toLowerCase();

describe("order cost permission audit hardening migration", () => {
  it("writes the sensitive grant audit inside the permission transaction", () => {
    const functionStart = sql.indexOf(
      "create or replace function public.repairdesk_replace_member_permission_grants_rpc",
    );
    const functionEnd = sql.indexOf("revoke all on function", functionStart);
    const functionSql = sql.slice(functionStart, functionEnd);

    expect(functionSql).toContain("update public.store_member_permission_grants");
    expect(functionSql).toContain("insert into public.store_member_permission_grants");
    expect(functionSql).toContain("insert into public.audit_logs");
    expect(functionSql).toContain("'update_member_permissions'");
    expect(functionSql).toContain("'permission_grants'");
    expect(functionSql).toContain("'target_user_id'");
    expect(functionSql.indexOf("insert into public.audit_logs")).toBeGreaterThan(
      functionSql.indexOf("insert into public.store_member_permission_grants"),
    );
  });

  it("keeps browser roles away from the security-definer RPC", () => {
    expect(sql).toContain(
      "from public, anon, authenticated, service_role;\ngrant execute on function",
    );
    expect(sql).toContain("to service_role;");
  });
});
