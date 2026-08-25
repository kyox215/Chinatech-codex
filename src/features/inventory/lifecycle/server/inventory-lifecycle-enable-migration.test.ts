import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const archivePath =
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260807120100_inventory_product_lifecycle_enable.sql";
const activePath = "supabase/migrations/20260807120100_inventory_product_lifecycle_enable.sql";
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

describe("inventory lifecycle enable migration", () => {
  it("keeps the enable body as inactive evidence-only lineage", () => {
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

  it("runs object, RLS, ACL and function security preflight before granting execute", () => {
    const preflight = migration.indexOf("inventory lifecycle enable preflight failed");
    const grant = migration.indexOf("grant execute on function");
    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(grant).toBeGreaterThan(preflight);
    expect(migration).toContain("relrowsecurity");
    expect(migration).toContain("has_table_privilege('anon'");
    expect(migration).toContain(
      "has_table_privilege('service_role', 'public.' || v_table, 'INSERT')",
    );
    expect(migration).toContain("has_function_privilege('service_role'");
    expect(migration).toContain("p.prosecdef");
    expect(migration).toContain("search_path=");
    expect(migration).toContain('search_path=""');
  });

  it("requires the active after-sales partial uniqueness contract", () => {
    expect(migration).toContain("inventory_after_sales_cases active order partial unique");
    expect(migration).toContain("status.*closed");
  });
});
