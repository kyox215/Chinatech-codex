import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260717182220_order_custody_retain_unlock_credentials.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const atomicStart = sql.indexOf(
  "create or replace function public.repairdesk_apply_order_atomic_mutation",
);
const returnStart = sql.indexOf(
  "create or replace function public.repairdesk_confirm_cancelled_order_return",
);
const terminalStart = sql.indexOf(
  "create or replace function public.repairdesk_correct_terminal_order_custody",
);
const importStart = sql.indexOf(
  "create or replace function public.repairdesk_apply_order_data_batch",
);
const atomicSql = sql.slice(atomicStart, returnStart);
const returnSql = sql.slice(returnStart, terminalStart);
const terminalSql = sql.slice(terminalStart, importStart);
const importSql = sql.slice(importStart);

describe("device custody unlock retention migration", () => {
  it("removes the database rule that forced customer-held devices to clear credentials", () => {
    expect(sql).toContain(
      "drop constraint if exists repair_orders_customer_custody_unlock_clear_check",
    );
    expect(sql).not.toContain("custody_credentials_must_clear");
    expect(sql).not.toContain("device_unlock_method = null");
    expect(sql).not.toContain("'credentials_cleared', true");
  });

  it("keeps completion custody explicit without requiring credential-null update keys", () => {
    const completionStart = atomicSql.indexOf(
      "p_update ->> 'status' = 'completed' or coalesce(v_target_bucket, '') = 'done'",
    );
    const completionSql = atomicSql.slice(
      completionStart,
      atomicSql.indexOf("if p_update ? 'device_unlock_pattern' then", completionStart),
    );

    expect(completionStart).toBeGreaterThan(0);
    expect(completionSql).toContain(
      "p_update ->> 'device_custody_status' is distinct from 'with_customer'",
    );
    for (const key of ["device_unlock_method", "device_unlock_value", "device_unlock_pattern"]) {
      expect(completionSql).not.toContain(`p_update ? '${key}'`);
      expect(completionSql).not.toContain(`p_update -> '${key}' = 'null'::jsonb`);
    }
  });

  it("keeps all custody mutation paths from clearing unlock columns implicitly", () => {
    for (const block of [atomicSql, returnSql, terminalSql, importSql]) {
      expect(block).not.toContain("device_unlock_method = null");
      expect(block).not.toContain("device_unlock_value = null");
      expect(block).not.toContain("device_unlock_pattern = null");
      expect(block).not.toContain("'credentials_cleared', true");
    }
    expect(returnSql).toContain("'credentials_cleared', false");
    expect(terminalSql).toContain("'credentials_cleared', false");
    expect(importSql).toContain("'credentials_cleared', false");
  });

  it("preserves bounded execution and service-role-only RPC privileges", () => {
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '5min'");
    expect(sql).toContain("reset statement_timeout");
    expect(sql).toContain("reset lock_timeout");
    expect(sql.match(/create or replace function public\.repairdesk_/g)).toHaveLength(4);
    expect(sql.match(/security invoker/g)).toHaveLength(3);
    expect(sql.match(/security definer/g)).toHaveLength(1);

    for (const functionName of [
      "repairdesk_apply_order_atomic_mutation",
      "repairdesk_confirm_cancelled_order_return",
      "repairdesk_correct_terminal_order_custody",
      "repairdesk_apply_order_data_batch",
    ]) {
      expect(sql).toContain(`revoke all on function public.${functionName}(`);
      expect(sql).toContain(`grant execute on function public.${functionName}(`);
    }
  });
});
