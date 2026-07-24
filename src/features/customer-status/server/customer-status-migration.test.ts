import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720190759_repair_order_customer_status_links.sql",
  ),
  "utf8",
);
const stableMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260724071717_fixed_order_customer_status_qr.sql"),
  "utf8",
);

describe("customer status link migration", () => {
  it("stores only token hashes with same-store order integrity and bounded expiry", () => {
    expect(migration).toContain("order_id uuid not null");
    expect(migration).toContain("token_hash text not null");
    expect(migration).toContain("lifecycle_revision bigint not null");
    expect(migration).not.toMatch(/\btoken\s+text\b/);
    expect(migration).toContain("foreign key (order_id, store_id)");
    expect(migration).toContain("references public.repair_orders (id, store_id)");
    expect(migration).toContain("expires_at <= created_at + interval '2 years'");
    expect(migration).toContain("repair_order_customer_status_links_one_unrevoked_idx");
  });

  it("keeps both link and rate-limit tables service-role-only", () => {
    expect(migration).toContain(
      "alter table public.repair_order_customer_status_links enable row level security",
    );
    expect(migration).toContain(
      "alter table public.customer_status_rate_limits enable row level security",
    );
    expect(migration).toMatch(
      /revoke all on table public\.repair_order_customer_status_links\s+from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /revoke all on table public\.customer_status_rate_limits\s+from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repairdesk_consume_customer_status_rate_limit_v1[\s\S]+to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repairdesk_consume_customer_status_public_request_v1[\s\S]+to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repairdesk_issue_customer_status_links_v1[\s\S]+to service_role/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.repairdesk_revoke_customer_status_links_v1[\s\S]+to service_role/,
    );
  });

  it("uses HMAC pseudonym-shaped distributed counters without IP or token columns", () => {
    expect(migration).toContain("scope_key text primary key");
    expect(migration).not.toMatch(/\bip_address\b|\braw_token\b|\buser_agent\b/);
    expect(migration).toContain("on conflict (scope_key) do update");
    expect(migration).toContain("least(rate_limit.attempt_count + 1, p_limit + 1)");
    expect(migration).toContain("customer_status_rate_limits_updated_idx");
    expect(migration).toContain("updated_at < v_now - interval '24 hours'");
    expect(migration).toContain(
      "coalesce(stale_link.revoked_at, stale_link.expires_at) < v_now - interval '90 days'",
    );
    expect(migration).toContain("limit 1000");
  });

  it("issues and revokes links atomically with ordered locks and audit rows", () => {
    expect(migration).toContain("repairdesk_issue_customer_status_links_v1");
    expect(migration).toContain("order by order_row.id");
    expect(migration).toContain("for update;");
    expect(migration).toContain("revoke_reason = 'reissued'");
    expect(migration).toContain("insert into public.audit_logs");
    expect(migration).toContain("repairdesk_revoke_customer_status_links_v1");
    expect(migration).toContain("uuid, uuid, uuid, text, text, text");
  });

  it("prechecks a saturated global bucket before creating an IP row", () => {
    const publicLimiter = migration.slice(
      migration.indexOf(
        "create or replace function public.repairdesk_consume_customer_status_public_request_v1",
      ),
    );
    expect(publicLimiter.indexOf("where scope_key = p_global_scope_key")).toBeLessThan(
      publicLimiter.indexOf("v_ip_result :="),
    );
    expect(publicLimiter).toContain("v_global.attempt_count >= p_global_limit");
    expect(publicLimiter).toContain("IP-blocked requests do not consume global capacity");
  });
});

describe("fixed customer status QR migration", () => {
  it("backfills exactly one opaque identity for every order without storing bearer tokens", () => {
    expect(stableMigration).toContain("order_id uuid primary key");
    expect(stableMigration).toContain("public_id uuid not null default gen_random_uuid()");
    expect(stableMigration).toContain(
      "constraint repair_order_customer_status_identities_public_id_unique",
    );
    expect(stableMigration).toContain("foreign key (order_id, store_id)");
    expect(stableMigration).not.toMatch(/\btoken\s+text\b|\btoken_hash\s+text\b|\braw_token\b/);
    expect(stableMigration).toContain("customer_status_identity_backfill_invalid");
  });

  it("keeps identities service-role-only and makes reset an audited atomic rotation", () => {
    expect(stableMigration).toContain(
      "alter table public.repair_order_customer_status_identities enable row level security",
    );
    expect(stableMigration).toMatch(
      /revoke all on table public\.repair_order_customer_status_identities\s+from public, anon, authenticated, service_role/,
    );
    expect(stableMigration).toContain("repairdesk_rotate_customer_status_identity_v2");
    expect(stableMigration).toContain("public_id = gen_random_uuid()");
    expect(stableMigration).toContain("generation = identity.generation + 1");
    expect(stableMigration).toContain("insert into public.audit_logs");
    expect(stableMigration).toContain("create table public.customer_status_qr_key_config");
    expect(stableMigration).toContain("active_key_version smallint not null");
    expect(stableMigration).toContain("customer_status_identity_key_version_mismatch");
    expect(stableMigration).toContain("customer_status_rotate_key_version_mismatch");
  });

  it("creates identities for future orders and rotates them when a store is restored", () => {
    expect(stableMigration).toContain("after insert on public.repair_orders");
    expect(stableMigration).toContain("repairdesk_rotate_customer_status_identities_on_restore_v2");
    expect(stableMigration).toContain("after update of phase, revision on public.store_lifecycles");
    expect(stableMigration).toContain(
      "repairdesk_lifecycle_fence_repair_order_customer_status_identities",
    );
  });
});
