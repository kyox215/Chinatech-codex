import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260926071024_order_purchasing_lines.sql"),
  "utf8",
).toLowerCase();
const router = readFileSync(resolve(process.cwd(), "src/server/api/repairdesk-router.ts"), "utf8");
const saveRpc = sql.slice(
  sql.indexOf("create or replace function public.repairdesk_save_order_purchase"),
  sql.indexOf("create or replace function public.repairdesk_batch_order_purchases"),
);
const batchRpc = sql.slice(
  sql.indexOf("create or replace function public.repairdesk_batch_order_purchases"),
  sql.indexOf("revoke all on function public.repairdesk_read_order_purchasing"),
);

describe("order purchasing migration contract", () => {
  it("uses independent server-only tables and dedicated RPCs", () => {
    for (const table of [
      "order_part_purchases",
      "order_part_purchase_revisions",
      "order_part_purchase_operations",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table}`);
    }
    for (const fn of [
      "repairdesk_read_order_purchasing",
      "repairdesk_save_order_purchase",
      "repairdesk_batch_order_purchases",
    ]) {
      expect(sql).toContain(`create or replace function public.${fn}`);
      expect(sql).toContain(`revoke all on function public.${fn}`);
      expect(sql).toContain(`grant execute on function public.${fn}`);
    }
  });

  it("does not write inventory, stock, allocation, or fault price records", () => {
    for (const forbiddenWrite of [
      /insert into public\.parts_purchase_lots/,
      /insert into public\.part_stock_movements/,
      /insert into public\.repair_order_line_costs/,
      /update public\.repair_order_line_costs/,
      /update public\.repair_orders\s+set\s+fault_prices/,
    ]) {
      expect(sql).not.toMatch(forbiddenWrite);
    }
    expect(sql).toContain("set parts_status = v_status, updated_at = p_now");
  });

  it("keeps exact money, permissions, idempotency, CAS, and partial results in the database boundary", () => {
    expect(sql).toContain("unit_cost_eur numeric(12, 2)");
    expect(sql).toContain("to_char(purchase.unit_cost_eur");
    expect(sql).toContain("repairdesk_actor_can_manage_order_costs");
    expect(sql).toContain("repairdesk_actor_has_supplier_permission");
    expect(sql).toContain("idempotency_conflict");
    expect(sql).toContain("stale_revision");
    expect(sql).toContain("v_results := v_results || jsonb_build_array");
    expect(sql).toContain("for update");
  });

  it("rechecks live permissions before replay and records mutation audit atomically", () => {
    for (const rpc of [saveRpc, batchRpc]) {
      expect(rpc.indexOf("repairdesk_actor_can_manage_order_costs")).toBeLessThan(
        rpc.indexOf("select * into v_receipt"),
      );
      expect(rpc).toContain("insert into public.audit_logs");
      expect(rpc.indexOf("insert into public.audit_logs")).toBeLessThan(
        rpc.indexOf("insert into public.order_part_purchase_operations"),
      );
    }
    expect(saveRpc).toContain("v_receipt.requires_supplier_assign");
    expect(saveRpc).toContain(
      "v_requires_supplier_assign := v_existing.supplier_id is distinct from p_supplier_id",
    );
    expect(batchRpc).toContain("p_operation = 'assign_supplier'");
  });

  it("locks every parent order in sorted order before any requested purchase row", () => {
    const parentLock = batchRpc.indexOf("from public.repair_orders order_row");
    const purchaseLock = batchRpc.indexOf(
      "select * into v_row from public.order_part_purchases purchase",
    );
    expect(parentLock).toBeGreaterThan(-1);
    expect(batchRpc.slice(parentLock, purchaseLock)).toContain("order by order_row.id");
    expect(parentLock).toBeLessThan(purchaseLock);
  });

  it("delegates save supplier-change authorization to the database and avoids duplicate production audit", () => {
    const saveRoute = router.slice(
      router.indexOf('case "orders/purchasing/save"'),
      router.indexOf('case "orders/purchasing/batch"'),
    );
    expect(saveRoute).not.toContain("if (input.supplier_id)");
    expect(saveRoute).toContain("api !== supabaseSource");
  });
});
