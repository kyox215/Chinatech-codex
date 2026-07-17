import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260717030000_order_device_custody_security_hardening.sql",
);
const sql = readFileSync(migrationPath, "utf8");

const atomicStart = sql.indexOf(
  "create or replace function public.repairdesk_apply_order_atomic_mutation",
);
const returnStart = sql.indexOf(
  "create or replace function public.repairdesk_confirm_cancelled_order_return",
);
const triggerStart = sql.indexOf(
  "create or replace function public.repairdesk_protect_voided_order",
);
const atomicSql = sql.slice(atomicStart, returnStart);
const returnSql = sql.slice(returnStart, triggerStart);
const triggerSql = sql.slice(triggerStart);

function extractWhitelists(operation: string, message: string) {
  const operationBlock = triggerSql.match(
    new RegExp(`v_operation = '${operation}'[\\s\\S]*?message = '${message}'`),
  )?.[0];
  expect(operationBlock).toBeDefined();

  return [
    ...(operationBlock ?? "").matchAll(/to_jsonb\((?:new|old)\) - array\[([\s\S]*?)\]::text\[\]/g),
  ].map((match) => [...match[1].matchAll(/'([^']+)'/g)].map((field) => field[1]).sort());
}

describe("device custody security hardening migration", () => {
  it("is a forward-only replacement with bounded execution settings", () => {
    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '5min'");
    expect(sql).toContain("reset statement_timeout");
    expect(sql).toContain("reset lock_timeout");
    expect(sql).not.toMatch(/alter\s+table\s+public\.repair_orders/i);
    expect(sql).not.toMatch(/drop\s+(function|trigger|table)/i);
    expect(sql.match(/create or replace function public\.repairdesk_/g)).toHaveLength(3);
  });

  it("authorizes the current exact order scope before generic replay", () => {
    const orderLock = atomicSql.indexOf("select order_row.*");
    const technicianScope = atomicSql.indexOf(
      "v_order.assignee_membership_id is distinct from v_membership_id",
    );
    const replayLookup = atomicSql.indexOf("select event_row.*");
    const replayReturn = atomicSql.indexOf("'code', 'idempotent_replay'");
    const activeState = atomicSql.indexOf("v_order.record_state <> 'active'");
    const staleVersion = atomicSql.indexOf("v_order.updated_at <> p_expected_updated_at");

    expect(orderLock).toBeGreaterThan(0);
    expect(technicianScope).toBeGreaterThan(orderLock);
    expect(replayLookup).toBeGreaterThan(technicianScope);
    expect(replayReturn).toBeGreaterThan(replayLookup);
    expect(activeState).toBeGreaterThan(replayReturn);
    expect(staleVersion).toBeGreaterThan(replayReturn);
    expect(atomicSql).toContain("v_fingerprint := md5(");
    expect(atomicSql).not.toContain("extensions.digest");
  });

  it("rejects null event types and recursively scans nested sensitive payload keys", () => {
    expect(atomicSql).toContain("if p_event_type is null");
    expect(atomicSql).toContain("with recursive payload_nodes(value)");
    expect(atomicSql).toContain("from jsonb_each(");
    expect(atomicSql).toContain("from jsonb_array_elements(");
    for (const key of [
      "device_unlock_value",
      "device_unlock_method",
      "device_unlock_pattern",
      "customer_signature",
      "password",
      "secret",
    ]) {
      expect(atomicSql).toContain(`'${key}'`);
    }
  });

  it("requires explicit string custody and explicit credential clearing on completion", () => {
    const completionStart = atomicSql.indexOf(
      "p_update ->> 'status' = 'completed' or coalesce(v_target_bucket, '') = 'done'",
    );
    const completionSql = atomicSql.slice(
      completionStart,
      atomicSql.indexOf("if p_update ? 'device_unlock_pattern' then", completionStart),
    );

    expect(completionStart).toBeGreaterThan(0);
    expect(completionSql).toContain("not (p_update ? 'device_custody_status')");
    expect(completionSql).toContain(
      "jsonb_typeof(p_update -> 'device_custody_status') is distinct from 'string'",
    );
    expect(completionSql).toContain(
      "p_update ->> 'device_custody_status' is distinct from 'with_customer'",
    );
    for (const key of ["device_unlock_method", "device_unlock_value", "device_unlock_pattern"]) {
      expect(completionSql).toContain(`p_update ? '${key}'`);
      expect(completionSql).toContain(`p_update -> '${key}' = 'null'::jsonb`);
    }
  });

  it("authorizes current membership and assignment before cancelled-return replay", () => {
    const roleGuard = returnSql.indexOf(
      "v_actor_role not in ('owner', 'manager', 'sales', 'technician')",
    );
    const orderLock = returnSql.indexOf("select order_row.*");
    const technicianScope = returnSql.indexOf(
      "v_order.assignee_membership_id is distinct from v_membership_id",
    );
    const replayLookup = returnSql.indexOf("select operation.*");
    const replayReturn = returnSql.indexOf("'code', 'idempotent_replay'");
    const staleVersion = returnSql.indexOf("v_order.updated_at <> p_expected_updated_at");

    expect(roleGuard).toBeGreaterThan(0);
    expect(orderLock).toBeGreaterThan(roleGuard);
    expect(technicianScope).toBeGreaterThan(orderLock);
    expect(replayLookup).toBeGreaterThan(technicianScope);
    expect(replayReturn).toBeGreaterThan(replayLookup);
    expect(staleVersion).toBeGreaterThan(replayReturn);
  });

  it("constrains every audited terminal operation to an explicit field whitelist", () => {
    const expected = {
      correction: {
        message: "terminal correction changed unauthorized fields",
        fields: [
          "issue_description",
          "diagnosis_result",
          "internal_tag",
          "accessory_notes",
          "warranty_text",
          "warranty_months",
          "warranty_change_reason",
          "warranty_changed_by",
          "warranty_changed_at",
          "updated_at",
        ],
      },
      reopen: {
        message: "terminal reopen changed unauthorized fields",
        fields: [
          "status",
          "workflow_status",
          "exception_status",
          "approval_flow_status",
          "parts_status",
          "notify_status",
          "completed_at",
          "delivered_at",
          "cancel_reason",
          "pause_reason",
          "updated_at",
        ],
      },
      void: {
        message: "terminal void changed unauthorized fields",
        fields: [
          "record_state",
          "voided_at",
          "voided_by",
          "void_reason",
          "deleted_at",
          "updated_at",
        ],
      },
      custody_return: {
        message: "terminal custody return changed unauthorized fields",
        fields: [
          "completed_at",
          "delivered_at",
          "device_custody_status",
          "device_unlock_method",
          "device_unlock_value",
          "device_unlock_pattern",
          "updated_at",
        ],
      },
      custody_correction: {
        message: "terminal custody correction changed unauthorized fields",
        fields: [
          "delivered_at",
          "device_custody_status",
          "device_unlock_method",
          "device_unlock_value",
          "device_unlock_pattern",
          "updated_at",
        ],
      },
    } as const;

    for (const [operation, contract] of Object.entries(expected)) {
      const whitelists = extractWhitelists(operation, contract.message);
      expect(whitelists).toHaveLength(2);
      expect(whitelists[0]).toEqual([...contract.fields].sort());
      expect(whitelists[1]).toEqual([...contract.fields].sort());
    }
  });

  it("keeps all mutation RPCs invoker-only and service-role-only", () => {
    expect(sql.match(/security invoker/g)).toHaveLength(3);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(3);
    for (const functionName of [
      "repairdesk_apply_order_atomic_mutation",
      "repairdesk_confirm_cancelled_order_return",
      "repairdesk_correct_terminal_order_custody",
    ]) {
      expect(sql).toContain(`revoke all on function public.${functionName}(`);
      expect(sql).toContain(`grant execute on function public.${functionName}(`);
    }
    expect(sql).toContain("revoke all on function public.repairdesk_protect_voided_order()");
  });
});
