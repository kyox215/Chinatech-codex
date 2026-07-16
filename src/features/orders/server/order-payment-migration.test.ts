import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260710145642_order_payment_ledger_atomic_rpc.sql",
  "utf8",
).toLowerCase();
const cancellationGuardMigration = readFileSync(
  "supabase/migrations/20260716175056_block_cancelled_order_payments.sql",
  "utf8",
).toLowerCase();

describe("atomic order payment migration contract", () => {
  it("creates an append-only same-store ledger with an idempotency key", () => {
    expect(migration).toContain("create table public.order_payment_ledger");
    expect(migration).toContain("foreign key (order_id, store_id)");
    expect(migration).toContain("unique (store_id, idempotency_key)");
    expect(migration).toContain("on update cascade on delete restrict");
    expect(migration).toContain("grant select, insert on table public.order_payment_ledger");
    expect(migration).not.toContain("grant all on table public.order_payment_ledger");
  });

  it("keeps the RPC invoker-only, schema-pinned, and unavailable to browser roles", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain("security definer");
    expect(migration).toContain(
      "from public, anon, authenticated;\n\n" +
        "grant execute on function public.repairdesk_record_order_payment",
    );
    expect(migration).toContain("to service_role");
  });

  it("locks the order and writes balance, ledger, event, and audit in one function", () => {
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.order_payment_ledger");
    expect(migration).toContain("update public.repair_orders");
    expect(migration).toContain("insert into public.order_events");
    expect(migration).toContain("insert into public.audit_logs");
    expect(migration.match(/where ledger\.store_id = p_store_id/g)).toHaveLength(2);
  });

  it("contains no destructive schema or data operation", () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|function|type)\b/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/);
    expect(migration).not.toMatch(/\btruncate\b/);
    expect(migration).not.toContain("pg_notify");
  });
});

describe("cancelled order payment guard migration", () => {
  it("keeps the atomic RPC and rejects status or exception cancellation signals", () => {
    expect(cancellationGuardMigration).toContain(
      "create or replace function public.repairdesk_record_order_payment",
    );
    expect(cancellationGuardMigration).toContain("v_order.status::text");
    expect(cancellationGuardMigration).toContain("v_order.exception_status::text");
    expect(cancellationGuardMigration).not.toContain("order_workflow_statuses");
    expect(cancellationGuardMigration).toContain("'code', 'order_cancelled'");
    expect(cancellationGuardMigration).toContain("for update");
    expect(cancellationGuardMigration).toContain("insert into public.order_payment_ledger");
  });

  it("preserves service-role-only execution and performs no destructive data operation", () => {
    expect(cancellationGuardMigration).toContain("security invoker");
    expect(cancellationGuardMigration).toContain("set search_path = ''");
    expect(cancellationGuardMigration).toContain("from public, anon, authenticated");
    expect(cancellationGuardMigration).toContain("to service_role");
    expect(cancellationGuardMigration).not.toMatch(/\bdrop\s+(table|column|function|type)\b/);
    expect(cancellationGuardMigration).not.toMatch(/\bdelete\s+from\b/);
    expect(cancellationGuardMigration).not.toContain("truncate");
  });
});
