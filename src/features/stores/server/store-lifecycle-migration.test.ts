import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const expandSql = read("20260717195346_store_lifecycle_control_plane.sql");
const operationsSql = read("20260717195516_store_lifecycle_atomic_operations.sql");
const purgeSql = read("20260717195519_store_lifecycle_export_purge_framework.sql");
const transitionsSql = read("20260717201728_store_lifecycle_transition_operations.sql");
const exportRestoreSql = read("20260717201729_store_export_restore_proof.sql");
const purgeExecutorSql = read("20260717201730_store_purge_executor_control.sql");
const businessFenceSql = read(
  "20260720013000_store_lifecycle_business_fence_and_close_recheck.sql",
);

describe("store lifecycle migrations", () => {
  it("keeps owner lifecycle separate from the platform store status", () => {
    expect(expandSql).toContain("create table if not exists public.store_lifecycles");
    expect(expandSql).toContain("phase text not null default 'active'");
    expect(expandSql).toContain("revision bigint not null default 1");
    expect(expandSql).not.toContain("alter type public.store_status add value");
  });

  it("keeps lifecycle data service-role only", () => {
    for (const table of [
      "store_lifecycles",
      "store_lifecycle_operations",
      "store_lifecycle_preflights",
      "store_lifecycle_challenges",
    ]) {
      expect(expandSql).toContain(`alter table public.${table} enable row level security`);
      expect(expandSql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }
    expect(expandSql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
  });

  it("requires lifecycle-active invite claims and an AAL2 one-time challenge for rename", () => {
    expect(operationsSql).toContain("public.repairdesk_store_lifecycle_active(link.store_id)");
    expect(operationsSql).toContain("pg_advisory_xact_lock");
    expect(operationsSql).toContain("STORE_LIFECYCLE_VERSION_CONFLICT");
    expect(operationsSql).toContain("STORE_LIFECYCLE_IDEMPOTENCY_CONFLICT");
    expect(operationsSql).toContain("challenge.assurance_level = 'aal2'");
    expect(operationsSql).toContain("challenge.status = 'issued'");
    expect(operationsSql).toContain("set status = 'consumed', consumed_at = v_now");
    expect(operationsSql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });

  it("creates a resumable private purge ledger without a mass-delete RPC", () => {
    expect(purgeSql).toContain("create table if not exists public.store_export_jobs");
    expect(purgeSql).toContain("create table if not exists public.store_purge_jobs");
    expect(purgeSql).toContain("create table if not exists public.store_purge_steps");
    expect(purgeSql).toContain("for update skip locked");
    expect(purgeSql).toContain("destructive_step_started boolean not null default false");
    expect(purgeSql).toContain("target_store_tombstone_hash");
    expect(purgeSql).not.toMatch(/delete\s+from\s+(storage\.objects|public\.stores)/i);
    expect(purgeSql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
  });

  it("closes and restores atomically while keeping revoked credentials revoked", () => {
    expect(transitionsSql).toContain("repairdesk_request_store_close_rpc");
    expect(transitionsSql).toContain("repairdesk_restore_store_rpc");
    expect(transitionsSql).toContain("repairdesk_finalize_store_archive_rpc");
    expect(transitionsSql).toContain("archive_eligible_at = v_now + interval '1 hour'");
    expect(transitionsSql).toContain("and challenge.operation_kind = 'request_close'");
    expect(transitionsSql).toContain("and challenge.assurance_level = 'aal2'");
    expect(transitionsSql).toContain("set status = 'inactive'::public.store_membership_status");
    expect(transitionsSql).toContain("and user_id <> p_actor_id");
    expect(transitionsSql).toContain("set status = 'cancelled'");
    expect(transitionsSql).toContain("set status = 'revoked'");
    expect(transitionsSql).toContain("'revoked_invitations_reactivated', false");
    expect(transitionsSql).toContain("'disabled_memberships_reactivated', false");
    expect(transitionsSql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });

  it("requires a complete deterministic export and an exact isolated restore proof", () => {
    expect(exportRestoreSql).toContain(
      "create table if not exists public.store_export_table_manifests",
    );
    expect(exportRestoreSql).toContain(
      "create table if not exists public.store_export_storage_objects",
    );
    expect(exportRestoreSql).toContain("create table if not exists public.store_restore_proofs");
    expect(exportRestoreSql).toContain("STORE_EXPORT_DATABASE_MANIFEST_INCOMPLETE");
    expect(exportRestoreSql).toContain("STORE_RESTORE_PROOF_MISMATCH");
    expect(exportRestoreSql).toContain("p_artifact_sha256 text");
    expect(exportRestoreSql).toContain("artifact_sha256 = p_artifact_sha256");
    expect(exportRestoreSql).toContain("table_info.table_name = 'stores'");
    expect(exportRestoreSql).toContain("column_info.udt_name = 'uuid'");
    expect(exportRestoreSql).not.toContain("constraint_info.confrelid = 'public.stores'::regclass");
    expect(exportRestoreSql).toContain(
      "case when v_catalog.table_name = 'stores' then 'id' else 'store_id' end",
    );
    expect(exportRestoreSql).toContain("'store_export_jobs'");
    expect(exportRestoreSql).toContain("jsonb_array_length(p_table_mismatches) <> 0");
    expect(exportRestoreSql).toContain("(p_smoke_checks ->> 'store_read')::boolean");
    expect(exportRestoreSql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });

  it("purges only a UUID-scoped catalog behind restore, lease, hold, and zero-residual gates", () => {
    expect(purgeExecutorSql).toContain("repairdesk_store_purge_catalog");
    expect(purgeExecutorSql).toContain("repairdesk_schedule_store_purge_rpc");
    expect(purgeExecutorSql).toContain("v_export.state <> 'restore_verified'");
    expect(purgeExecutorSql).toContain("challenge.operation_kind = 'schedule_purge'");
    expect(purgeExecutorSql).toContain("repairdesk_renew_store_purge_lease_rpc");
    expect(purgeExecutorSql).toContain("repairdesk_prepare_store_purge_database_rpc");
    expect(purgeExecutorSql).toContain("constraint_info.confdeltype in ('a', 'r')");
    expect(purgeExecutorSql).toContain(
      "constraint_info.conname <> 'inventory_attachments_agreement_fkey'",
    );
    expect(purgeExecutorSql).toContain("set agreement_id = null");
    expect(purgeExecutorSql).toContain("lifecycle.phase in ('purge_scheduled', 'purging')");
    expect(purgeExecutorSql).toContain("where store_id = $1 limit $2");
    expect(purgeExecutorSql).toContain("repairdesk_store_purge_residual_counts");
    expect(purgeExecutorSql).toContain(
      "other_tenant_before_sha256 is distinct from p_other_tenant_after_sha256",
    );
    expect(purgeExecutorSql).toContain("delete from public.stores where id = v_store_id");
    expect(purgeExecutorSql).toContain("insert into public.store_tombstones");
    expect(purgeExecutorSql).toContain("v_export.artifact_sha256");
    expect(purgeExecutorSql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });

  it("serializes tenant writes and rechecks live blockers before close", () => {
    expect(businessFenceSql).toContain("repairdesk_00_initialize_store_lifecycle_trigger");
    expect(businessFenceSql).toContain(
      "for each row execute function public.repairdesk_initialize_store_lifecycle()",
    );
    expect(businessFenceSql).toContain("repairdesk_store_lifecycle_contract_version");
    expect(businessFenceSql).toContain("select 2;");
    expect(businessFenceSql).toContain("repairdesk_enforce_active_store_write");
    expect(businessFenceSql).toContain("pg_advisory_xact_lock_shared");
    expect(businessFenceSql).toContain("STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN");
    expect(businessFenceSql).toContain("repairdesk_store_close_blockers");
    expect(businessFenceSql).toContain("orders.status::text not in ('completed', 'cancelled')");
    expect(businessFenceSql).toContain("pg_advisory_xact_lock(");
    expect(businessFenceSql).toContain("v_live_blockers :=");
    expect(businessFenceSql).toContain("STORE_LIFECYCLE_BLOCKED");
    expect(businessFenceSql).toContain("preflight.storage_summary");
    expect(businessFenceSql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });
});

function read(file: string) {
  return readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8");
}
