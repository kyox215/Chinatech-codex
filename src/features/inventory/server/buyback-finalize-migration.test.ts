import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20260712150000_buyback_guided_evidence_finalize.sql";

function readMigration() {
  return readFileSync(join(process.cwd(), migrationPath), "utf8");
}

describe("atomic buyback finalize migration", () => {
  it("keeps identity evidence private and the agreement schema dormant", () => {
    const sql = readMigration();

    expect(sql).toContain("'repairdesk-buyback-evidence'");
    expect(sql).toContain("false,\n  8388608");
    expect(sql).toMatch(
      /revoke all on table public\.buyback_agreements from public, anon, authenticated, service_role/i,
    );
    expect(sql).not.toMatch(/grant .*buyback_agreements.* (?:authenticated|service_role)/i);
  });

  it("runs payment preflight before writes and bounds production locks", () => {
    const sql = readMigration();

    expect(sql).toContain("set lock_timeout = '5s'");
    expect(sql).toContain("set statement_timeout = '5min'");
    expect(sql.indexOf("duplicate buyback_payment rows")).toBeLessThan(
      sql.indexOf("insert into storage.buckets"),
    );
    expect(sql.indexOf("pre-finalization items with legacy buyback payments")).toBeLessThan(
      sql.indexOf("insert into storage.buckets"),
    );
  });

  it("serializes idempotency, locks the item, and enforces optimistic versioning", () => {
    const sql = readMigration();

    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("idempotent_replay");
    expect(sql).toContain("idempotency_conflict");
    expect(sql).toContain("stale_version");
    expect(sql).toContain("unique (store_id, idempotency_key)");
    expect(sql).toContain("'buyback-serial:' || p_store_id::text || ':' || v_serial");
    expect(sql).toContain("lower(btrim(coalesce(other_item.serial_or_imei, ''))) = v_serial");
  });

  it("writes quality, purchased state, one payment, agreement, evidence binding, event and audit inside the RPC", () => {
    const sql = readMigration();

    expect(sql).toContain("insert into public.inventory_quality_checks");
    expect(sql).toContain("pg_catalog.format_type");
    expect(sql).toContain("attribute.atttypid");
    expect(sql).toContain("attribute.atttypmod");
    expect(sql).toContain("jsonb_populate_record");
    expect(sql).toContain("null::public.inventory_items");
    expect(sql).toContain("'status', 'purchased'");
    expect(sql).toContain("status = patch.status");
    expect(sql).toContain("item.id::text = p_item_id");
    expect(sql).toContain("insert into public.inventory_transactions");
    expect(sql).toContain("'id', gen_random_uuid()::text");
    expect(sql).toContain("returning id into v_payment_id");
    expect(sql).toContain("inventory_transactions_one_buyback_payment_idx");
    expect(sql).toContain("insert into public.buyback_agreements");
    expect(sql).toContain("evidence_status = 'bound'");
    expect(sql).toContain("insert into public.inventory_events");
    expect(sql).toContain("insert into public.audit_logs");
    expect(sql).toContain("for update");
    expect(sql).toContain("- 'buyback_customer'");
    expect(sql).not.toContain("transaction_type::text");
    expect(sql).not.toMatch(
      /::public\.inventory_(?:item_status|check_status|cosmetic_grade|functional_grade)/,
    );
  });

  it("stops before applying when legacy payments need reconciliation", () => {
    const sql = readMigration();

    expect(sql).toContain("duplicate buyback_payment rows require owner-reviewed reconciliation");
    expect(sql).toContain(
      "pre-finalization items with legacy buyback payments require owner-reviewed reconciliation",
    );
  });

  it("keeps passport and declaration rules in the database gate", () => {
    const sql = readMigration();

    expect(sql).toContain("p_document_type <> 'passport'");
    expect(sql).toContain("ownership_confirmed");
    expect(sql).toContain("data_wipe_authorized");
    expect(sql).toContain("no_invoice_confirmed");
    expect(sql).toContain("no_box_confirmed");
    expect(sql).toContain("signature_stale");
    expect(sql).toContain("'payment' ->> 'method'");
    expect(sql).toContain("'device' ->> 'brand'");
    expect(sql).toContain("^[A-Za-z0-9]{1,4}$");
    expect(sql).toContain("seller_mismatch");
    expect(sql).toContain("from public.customers as customer");
    expect(sql).toContain("6dc1170ad137c5c8e0b027c24f47adae7f3cada24bf3e9432e4495999996eec6");
    expect(sql).toContain("6078b738a34bbe22e01b004cef8ebd58f3ae914b941adf605302540c35d73361");
    expect(sql).toContain("'legal_documents' -> 'privacy_notice'");
    expect(sql).toContain("'legal_documents' -> 'buyback_terms'");
  });

  it("requires fresh restricted staged evidence while keeping the RPC dormant", () => {
    const sql = readMigration();

    expect(sql).toContain("attachment.storage_bucket = 'repairdesk-buyback-evidence'");
    expect(sql).toContain("attachment.sensitivity = 'restricted'");
    expect(sql).toContain("attachment.evidence_status = 'staged'");
    expect(sql).toContain("attachment.staging_expires_at > v_now");
    expect(sql).toContain("staging_expires_at = null");
    expect(sql).toContain("security invoker");
    expect(sql).toMatch(
      /revoke all on function public\.repairdesk_finalize_buyback[\s\S]*from public, anon, authenticated, service_role/i,
    );
    expect(sql).not.toMatch(/grant execute on function public\.repairdesk_finalize_buyback/i);
  });
});
