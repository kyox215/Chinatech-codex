import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const dormantMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql",
);
const liveProviderMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718223739_ai_assistant_live_provider_v1.sql",
);
const lifecycleFenceHotfixMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260720065246_ai_usage_bucket_store_fence_hotfix.sql",
);
const dormantSql = readFileSync(dormantMigrationPath, "utf8");
const liveProviderSql = readFileSync(liveProviderMigrationPath, "utf8");
const lifecycleFenceHotfixSql = readFileSync(lifecycleFenceHotfixMigrationPath, "utf8");
const sql = `${dormantSql}\n${liveProviderSql}`;

describe("AI cost governance migration chain", () => {
  it("preserves the applied dormant migration and adds a separate live-provider upgrade", () => {
    expect(dormantSql).toContain("create table public.ai_assistant_usage_policies");
    expect(dormantSql).toContain("create table public.ai_assistant_usage_buckets");
    expect(dormantSql).toContain("create table public.ai_assistant_usage_requests");
    expect(dormantSql).not.toContain("requests_per_actor_minute");
    expect(liveProviderSql).toContain("create table public.ai_assistant_actor_rate_buckets");
    expect(liveProviderSql).toContain("add column requests_per_actor_minute integer not null");
    expect(liveProviderSql).toContain("add column actor_minute_bucket_id uuid not null");
    expect(liveProviderSql).toContain("requires empty dormant policy, bucket, and request tables");
    expect(sql).toContain("set lock_timeout = '5s';");
    expect(sql).not.toMatch(/insert\s+into\s+public\.ai_assistant_usage_policies/i);
    expect(sql).not.toMatch(/drop\s+(?:table|column|schema)/i);
  });

  it("uses atomic idempotent reserve, conservative settlement and store-local time buckets", () => {
    expect(sql).toContain("repairdesk_reserve_ai_usage");
    expect(sql).toContain("repairdesk_finalize_ai_usage");
    expect(sql).toContain("repairdesk_release_ai_usage_pre_dispatch");
    expect(sql).toContain("repairdesk_settle_stale_ai_usage");
    expect(sql).toContain("repairdesk_attest_ai_usage_policy");
    expect(sql).toContain("repairdesk_maintain_ai_usage");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("unique (store_id, client_request_id)");
    expect(sql).toContain("at time zone v_policy.quota_timezone");
    expect(sql).toContain("settlement_basis = 'reserved_max'");
    expect(sql).toContain("status = 'disabled'");
    expect(sql).toContain("ai_usage_policy_reservation_floor_check");
    expect(sql).toContain("inventory_vision_max_input_tokens");
    expect(sql).toContain("requests_per_actor_minute");
    expect(sql).toContain("actor_minute_limit_reached");
  });

  it("keeps active period buckets continuous across policy versions and releases unsent counts", () => {
    const bucketIdentityIndex = sql.match(
      /create unique index ai_assistant_usage_bucket_identity_idx([\s\S]*?)\n\s*\);/,
    )?.[1];
    expect(bucketIdentityIndex).toBeTruthy();
    expect(bucketIdentityIndex).not.toContain("policy_version");
    expect(sql).toContain("'global_month:' || v_month_start::text");
    expect(sql).not.toContain("p_policy_version || ':global_month:'");
    expect(sql).toContain("quota_timezone_rotation_forbidden");
    expect(sql).toContain("cost_limit_microusd = least(");
    expect(sql).toContain("request_limit = least(");

    const releaseFunction = liveProviderSql.match(
      /create or replace function public\.repairdesk_release_ai_usage_pre_dispatch([\s\S]*?)\n\$\$;/,
    )?.[1];
    expect(releaseFunction).toBeTruthy();
    expect(releaseFunction).toContain("request_count = greatest(request_count - 1, 0)");
    expect(releaseFunction).toContain("ai_assistant_actor_rate_buckets");
  });

  it("attests the full runtime contract and retains conservative reservations", () => {
    const attestationFunction = liveProviderSql.match(
      /create or replace function public\.repairdesk_attest_ai_usage_policy([\s\S]*?)\n\$\$;/,
    )?.[1];
    expect(attestationFunction).toBeTruthy();
    for (const field of [
      "policy_version",
      "pricing_version",
      "quota_timezone",
      "order_text_model",
      "inventory_vision_model",
      "requests_per_actor_minute",
      "order_text_max_reservation_microusd",
      "inventory_vision_max_reservation_microusd",
      "max_provider_attempts",
      "reservation_ttl_seconds",
    ]) {
      expect(attestationFunction).toContain(`'${field}'`);
    }
    expect(attestationFunction).toContain("policy_configuration_mismatch");

    const maintenanceFunction = liveProviderSql.match(
      /create or replace function public\.repairdesk_maintain_ai_usage([\s\S]*?)\n\$\$;/,
    )?.[1];
    expect(maintenanceFunction).toBeTruthy();
    expect(maintenanceFunction).toContain("repairdesk_settle_stale_ai_usage");
    expect(maintenanceFunction).toContain("request_row.state <> 'reserved'");
    expect(maintenanceFunction).toContain("request_row.finalized_at < p_retention_before");
    expect(maintenanceFunction).toContain("not exists");
    expect(maintenanceFunction).toContain("for update skip locked");
  });

  it("keeps tables private and RPCs service-role-only", () => {
    for (const table of [
      "ai_assistant_usage_policies",
      "ai_assistant_usage_buckets",
      "ai_assistant_actor_rate_buckets",
      "ai_assistant_usage_requests",
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role`,
          "i",
        ),
      );
    }
    const functionNames = new Set(
      [...sql.matchAll(/create or replace function public\.(repairdesk_[a-z_]+)/g)].map(
        (match) => match[1],
      ),
    );
    expect(functionNames).toEqual(
      new Set([
        "repairdesk_attest_ai_usage_policy",
        "repairdesk_reserve_ai_usage",
        "repairdesk_finalize_ai_usage",
        "repairdesk_release_ai_usage_pre_dispatch",
        "repairdesk_settle_stale_ai_usage",
        "repairdesk_maintain_ai_usage",
      ]),
    );
    expect(sql.match(/security invoker/g) ?? []).toHaveLength(8);
    expect(sql.match(/set search_path = ''/g) ?? []).toHaveLength(8);
  });

  it("does not persist actor or customer content in the request ledger", () => {
    const requestTable = sql.match(
      /create table public\.ai_assistant_usage_requests \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(requestTable).toBeTruthy();
    expect(requestTable).not.toMatch(
      /\n\s+(?:actor_id|actor_hash|prompt|message|image|ocr|order_id|order_reference|imei|serial|safety_identifier)\s/i,
    );
    expect(requestTable).toMatch(/request_fingerprint_hmac text not null/);
    expect(liveProviderSql).toMatch(/add column actor_minute_bucket_id uuid not null/);

    const actorRateTable = liveProviderSql.match(
      /create table public\.ai_assistant_actor_rate_buckets \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(actorRateTable).toBeTruthy();
    expect(actorRateTable).toMatch(/actor_fingerprint_hmac text not null/);
    expect(actorRateTable).not.toMatch(/\n\s+(?:actor_id|email|phone|name|prompt|image)\s/i);
  });

  it("keeps valid global quota buckets storeless without weakening store lifecycle fences", () => {
    expect(dormantSql).toContain(
      "scope in ('global_day', 'global_month') and store_id is null and request_kind = 'all'",
    );
    expect(lifecycleFenceHotfixSql).toContain(
      "create or replace function public.repairdesk_enforce_ai_usage_bucket_store_write()",
    );
    expect(lifecycleFenceHotfixSql).toContain("v_scope not in ('global_day', 'global_month')");
    expect(lifecycleFenceHotfixSql).toContain("v_request_kind is distinct from 'all'");
    expect(lifecycleFenceHotfixSql).toContain("AI_USAGE_BUCKET_TRIGGER_MISBOUND");
    expect(lifecycleFenceHotfixSql).toContain("AI_USAGE_BUCKET_IDENTITY_CHANGE_FORBIDDEN");
    expect(lifecycleFenceHotfixSql).toContain("AI_USAGE_BUCKET_GLOBAL_DELETE_FORBIDDEN");
    for (const identityField of [
      "id",
      "policy_version",
      "scope",
      "request_kind",
      "store_id",
      "period_start_at",
      "period_end_at",
      "quota_timezone",
      "created_at",
    ]) {
      expect(lifecycleFenceHotfixSql).toContain(
        `old.${identityField} is distinct from new.${identityField}`,
      );
    }
    expect(lifecycleFenceHotfixSql).toContain("STORE_LIFECYCLE_STORE_REQUIRED");
    expect(lifecycleFenceHotfixSql).toContain("STORE_LIFECYCLE_CROSS_STORE_WRITE_FORBIDDEN");
    expect(lifecycleFenceHotfixSql).toContain("pg_advisory_xact_lock_shared");
    expect(lifecycleFenceHotfixSql).toContain("v_store_status is distinct from 'active'");
    expect(lifecycleFenceHotfixSql).toContain("v_lifecycle_phase is distinct from 'active'");
    expect(lifecycleFenceHotfixSql).toContain("STORE_LIFECYCLE_WRITE_BLOCKED");
    expect(lifecycleFenceHotfixSql).toContain(
      "drop trigger if exists repairdesk_lifecycle_fence_ai_assistant_usage_buckets",
    );
    expect(lifecycleFenceHotfixSql).toContain(
      "execute function public.repairdesk_enforce_ai_usage_bucket_store_write()",
    );
  });

  it("serializes store closing with unresolved provider reservations", () => {
    expect(lifecycleFenceHotfixSql).toContain(
      "create or replace function public.repairdesk_block_store_transition_with_reserved_ai_usage()",
    );
    expect(lifecycleFenceHotfixSql).toContain(
      "old.phase::text = 'active' and new.phase::text is distinct from 'active'",
    );
    expect(lifecycleFenceHotfixSql).toContain("pg_advisory_xact_lock(");
    expect(lifecycleFenceHotfixSql).toContain("request_row.state = 'reserved'");
    expect(lifecycleFenceHotfixSql).toContain("message = 'STORE_LIFECYCLE_BLOCKED'");
    expect(lifecycleFenceHotfixSql).toContain("detail = '{\"ai_usage_reserved\":true}'");
    expect(lifecycleFenceHotfixSql).toContain(
      "drop trigger if exists repairdesk_00_reserved_ai_usage_transition_fence",
    );
    expect(lifecycleFenceHotfixSql).toContain("before update of phase on public.store_lifecycles");
    expect(lifecycleFenceHotfixSql).toContain(
      "execute function public.repairdesk_block_store_transition_with_reserved_ai_usage()",
    );
  });

  it("keeps the AI usage bucket fence private and migration-safe", () => {
    expect(lifecycleFenceHotfixSql).toContain("begin;");
    expect(lifecycleFenceHotfixSql).toContain("set local lock_timeout = '5s';");
    expect(lifecycleFenceHotfixSql).toContain("commit;");
    expect(lifecycleFenceHotfixSql).not.toMatch(/drop\s+(?:table|column|schema)/i);
    expect(lifecycleFenceHotfixSql).not.toMatch(/alter\s+table[\s\S]*disable\s+trigger/i);
    expect(lifecycleFenceHotfixSql).not.toMatch(/grant\s+execute/i);
    for (const functionName of [
      "repairdesk_enforce_ai_usage_bucket_store_write",
      "repairdesk_block_store_transition_with_reserved_ai_usage",
    ]) {
      for (const role of ["public", "anon", "authenticated"]) {
        expect(lifecycleFenceHotfixSql).toMatch(
          new RegExp(`revoke all on function public\\.${functionName}\\(\\)\\s+from ${role}`, "i"),
        );
      }
    }
  });
});
