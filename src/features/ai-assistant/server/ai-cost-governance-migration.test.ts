import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("AI cost governance migration draft", () => {
  it("is additive, dormant and contains no enabled policy seed", () => {
    expect(sql).toContain("create table public.ai_assistant_usage_policies");
    expect(sql).toContain("create table public.ai_assistant_usage_buckets");
    expect(sql).toContain("create table public.ai_assistant_usage_requests");
    expect(sql).not.toMatch(/insert\s+into\s+public\.ai_assistant_usage_policies/i);
    expect(sql).not.toMatch(/drop\s+(?:table|column|schema)/i);
  });

  it("uses atomic idempotent reserve, conservative settlement and store-local time buckets", () => {
    expect(sql).toContain("repairdesk_reserve_ai_usage");
    expect(sql).toContain("repairdesk_finalize_ai_usage");
    expect(sql).toContain("repairdesk_release_ai_usage_pre_dispatch");
    expect(sql).toContain("repairdesk_settle_stale_ai_usage");
    expect(sql).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(sql).toContain("unique (store_id, client_request_id)");
    expect(sql).toContain("at time zone v_policy.quota_timezone");
    expect(sql).toContain("settlement_basis = 'reserved_max'");
    expect(sql).toContain("status = 'disabled'");
    expect(sql).toContain("ai_usage_policy_reservation_floor_check");
    expect(sql).toContain("inventory_vision_max_input_tokens");
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

    const releaseFunction = sql.match(
      /create or replace function public\.repairdesk_release_ai_usage_pre_dispatch([\s\S]*?)\n\$\$;/,
    )?.[1];
    expect(releaseFunction).toBeTruthy();
    expect(releaseFunction).toContain("request_count = greatest(request_count - 1, 0)");
  });

  it("keeps tables private and RPCs service-role-only", () => {
    for (const table of [
      "ai_assistant_usage_policies",
      "ai_assistant_usage_buckets",
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
    expect(sql.match(/security invoker/g) ?? []).toHaveLength(4);
    expect(sql.match(/set search_path = ''/g) ?? []).toHaveLength(4);
    expect(sql.match(/grant execute on function public\.repairdesk_/g) ?? []).toHaveLength(4);
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
  });
});
