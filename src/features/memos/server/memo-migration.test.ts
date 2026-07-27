import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260727005412_store_memos_v1.sql", "utf8");

describe("store memos migration contract", () => {
  it("creates exactly the private business and metadata receipt tables", () => {
    expect(migration).toContain("create table public.store_memos");
    expect(migration).toContain("create table public.store_memo_operation_receipts");
    expect(migration).toContain("alter table public.store_memos enable row level security");
    expect(migration).toContain(
      "revoke all on table public.store_memos from public, anon, authenticated",
    );
  });

  it("keeps actor and assignee references constrained to the same store", () => {
    expect(migration).toContain("store_memos_assignee_same_store_fkey");
    expect(migration).toContain("references public.store_memberships(id, store_id)");
    expect(migration).toContain("store_memos_kind_fields_check");
  });

  it("uses a service-role-only atomic RPC with idempotency and optimistic version", () => {
    expect(migration).toContain("repairdesk_mutate_store_memo_rpc");
    expect(migration).toContain("MEMO_VERSION_CONFLICT");
    expect(migration).toContain("MEMO_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("repairdesk_consume_authenticated_rate_limit_rpc");
    expect(migration).toContain("pg_advisory_xact_lock_shared");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("pg_catalog.jsonb_build_object");
    expect(migration).not.toContain("concat_ws");
    expect(migration).toContain("to service_role");
    const memoRpcSection = migration.slice(
      migration.indexOf("create or replace function public.repairdesk_mutate_store_memo_rpc"),
    );
    expect(memoRpcSection).not.toMatch(/grant execute[\s\S]{0,300}to authenticated/);
  });

  it("adds lifecycle fences, dynamic-catalog-compatible store_id and purge-safe revisions", () => {
    expect(migration).toContain("repairdesk_lifecycle_fence_store_memos");
    expect(migration).toContain("repairdesk_lifecycle_fence_store_memo_operation_receipts");
    expect(migration).toMatch(/if tg_op = 'DELETE' then\s+return old;/);
    expect(migration).toContain("after insert or update or delete on public.store_memos");
    expect(migration).toContain("'domain', 'memos'");
    expect(migration).toContain("jsonb_build_array('memos.all')");
    expect(migration).not.toContain("'title', v_memo.title");
    expect(migration).not.toContain("'content', v_memo.content");
  });
});
