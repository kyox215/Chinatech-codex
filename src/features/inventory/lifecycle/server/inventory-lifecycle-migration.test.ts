import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const archivePath =
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260807120000_inventory_product_lifecycle.sql";
const activePath = "supabase/migrations/20260807120000_inventory_product_lifecycle.sql";
const manifest = JSON.parse(
  readFileSync(
    resolve(
      repoRoot,
      "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/MANIFEST.json",
    ),
    "utf8",
  ),
) as {
  artifacts: Array<{
    archive_path: string;
    bytes: number;
    sha256: string;
    production_applied: boolean;
    status: string;
    active_schema_implication: boolean;
  }>;
};
const migration = readFileSync(resolve(repoRoot, archivePath), "utf8");

function commandBody(command: string, nextCommand: string) {
  const start = migration.indexOf(`elsif v_command = '${command}'`);
  const end = migration.indexOf(`elsif v_command = '${nextCommand}'`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}

describe("inventory lifecycle migration contracts", () => {
  it("keeps the lifecycle expand body as inactive evidence-only lineage", () => {
    const artifact = manifest.artifacts.find((entry) => entry.archive_path === archivePath);

    expect(artifact).toBeDefined();
    expect(existsSync(resolve(repoRoot, activePath))).toBe(false);
    expect(existsSync(resolve(repoRoot, archivePath))).toBe(true);
    if (!artifact) return;
    const contents = readFileSync(resolve(repoRoot, archivePath));

    expect(contents.byteLength).toBe(artifact.bytes);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(artifact.sha256);
    expect(artifact.production_applied).toBe(false);
    expect(artifact.status).toBe("evidence_only");
    expect(artifact.active_schema_implication).toBe(false);
  });

  it("keeps acquisition behind a coarse owner or manager database fence", () => {
    expect(migration).toContain(
      "v_command = 'acquisition.save' and v_actor_role not in ('owner', 'manager')",
    );
  });

  it("targets the production text status projection without a legacy enum cast", () => {
    expect(migration).toContain("'inventory_items.status text'");
    expect(migration).toContain("'inventory_stock_units.status text'");
    expect(migration).not.toContain("::public.inventory_item_status");
  });

  it("preserves the locked stock-unit cost when acquisition cost is omitted", () => {
    const body = migration.slice(
      migration.indexOf("if v_command in ('acquisition.save', 'inspection.save')"),
      migration.indexOf("elsif v_command = 'reservation.create'"),
    );
    expect(body).toContain("nullif(v_payload ->> 'cost_amount', '')::numeric");
    expect(body).toContain("v_unit.cost_amount");
  });

  it("validates reservation deposit, customer and dates before the first write", () => {
    const body = commandBody("reservation.create", "payment.append");
    const firstOrderInsert = body.indexOf("insert into public.inventory_sale_orders");
    const firstStockUpdate = body.indexOf("update public.inventory_stock_units");

    expect(body).toContain("v_amount < 0 or v_amount > v_price");
    expect(body).toContain("customer.id = v_customer_id and customer.store_id = p_store_id");
    expect(body).toContain("v_expires_at := coalesce");
    expect(body.indexOf("if v_amount < 0 or v_amount > v_price")).toBeLessThan(firstOrderInsert);
    expect(
      body.indexOf("return jsonb_build_object('ok', false, 'code', 'invalid_amount')"),
    ).toBeLessThan(firstOrderInsert);
    expect(firstOrderInsert).toBeLessThan(firstStockUpdate);
  });

  it("does not append a partial tail payment before sale completion fails", () => {
    const body = commandBody("sale.complete", "pickup.confirm");
    const paymentInsert = body.indexOf("insert into public.inventory_sale_payment_entries");
    expect(body).toContain("v_paid + v_amount <> v_order.agreed_price");
    expect(body).toContain("v_paid > v_order.agreed_price");
    expect(body.indexOf("if v_paid + v_amount <> v_order.agreed_price")).toBeLessThan(
      paymentInsert,
    );
    expect(migration).toContain("repairdesk_complete_inventory_sale_v2(");
    expect(body).toContain("v_start < v_order.reserved_at");
    expect(body).toContain("v_start < v_latest_payment_at");
  });

  it("fences payment reversals to one positive payment in the same order", () => {
    const body = commandBody("payment.append", "sale.complete");
    expect(body).toContain("if v_order.status not in ('sold', 'cancelled')");
    expect(body).toContain("if v_order.status <> 'reserved'");
    expect(body).toContain("payment.sale_order_id = v_order_id");
    expect(body).toContain("v_original_payment.kind not in ('deposit', 'balance', 'payment')");
    expect(body).toContain("reversal.reversal_of = v_payment_id");
    expect(body).toContain("v_refunded + v_amount > v_original_payment.amount");
    expect(body).toContain("if nullif(v_payload ->> 'reversal_of', '') is not null");
    expect(body).toContain("v_start < v_original_payment.occurred_at");
    expect(body).toContain("v_start < v_order.reserved_at");
    expect(body).toContain("v_start > v_now + interval '5 minutes'");
  });

  it("starts default commercial warranty at first pickup and syncs legacy fields", () => {
    const body = commandBody("pickup.confirm", "reservation.cancel");
    expect(migration).toContain("add column if not exists warranty_start timestamptz");
    expect(body).toContain("v_months := nullif(v_payload ->> 'warranty_months', '')::integer");
    expect(body).not.toContain(
      "coalesce(nullif(v_payload ->> 'warranty_months', '')::integer, 12)",
    );
    expect(body).toContain("basis, months, starts_at, ends_at");
    expect(body).toContain("'commercial', v_months, v_start, v_end");
    expect(body).toContain("warranty_start = v_start");
    expect(body).toContain("warranty_until = v_end");
    expect(body).toContain("inventory_pickup_override_ledger");
    expect(migration).toContain("'override_reason', btrim(v_payload ->> 'override_reason')");
    expect(migration).toContain("'outstanding_balance', v_balance");
  });

  it("records an explicit cancellation disposition without mutating the payment ledger", () => {
    const body = commandBody("reservation.cancel", "warranty.adjust");
    expect(body).toContain("refund_pending");
    expect(body).toContain("'retain'");
    expect(body).toContain("'pending'");
    expect(body).not.toContain("v_disposition not in ('refund',");
    expect(body).not.toContain("insert into public.inventory_sale_payment_entries");
  });

  it("only adjusts an already delivered sale and appends commercial versions", () => {
    const body = commandBody("warranty.adjust", "after_sales.create");
    expect(body).toContain("v_order.status <> 'sold' or v_order.actual_pickup_at is null");
    expect(body).toContain("values(p_store_id,v_order_id,v_version,'commercial'");
    expect(body).toContain("nullif(v_version - 1, 0)");
    expect(body).toContain("warranty_start = v_start");
    expect(body).toContain("warranty_until = v_end");
    expect(body).toContain("warranty_months = v_months");
    expect(body).not.toContain("v_order.status not in ('sold','reserved')");
  });
});
