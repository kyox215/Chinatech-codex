import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260806222149_authenticated_toolkit_library.sql"),
  "utf8",
);

describe("authenticated toolkit migration guardrails", () => {
  it("keeps the resource table service-role-only", () => {
    expect(migration).toMatch(/alter table public\.toolkit_resources enable row level security/i);
    expect(migration).toMatch(
      /revoke all on table public\.toolkit_resources from public, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /grant select, insert, update, delete on table public\.toolkit_resources to service_role/i,
    );
  });

  it("keeps the private storage bucket and its 200 MiB limit on upsert", () => {
    expect(migration).toMatch(
      /'repairdesk-toolkit-files',\s*'repairdesk-toolkit-files',\s*false,\s*209715200/is,
    );
    expect(migration).toMatch(/on conflict \(id\) do update set[\s\S]*public = false/is);
    expect(migration).toMatch(/file_size_limit = excluded\.file_size_limit/is);
  });

  it("requires clean scanned files before publication and prevents path reuse", () => {
    expect(migration).toMatch(/security_review_state = 'clean'/i);
    expect(migration).toMatch(
      /create unique index if not exists toolkit_resources_storage_object_unique_idx/i,
    );
    expect(migration).toMatch(/on public\.toolkit_resources \(storage_bucket, storage_path\)/i);
  });
});
