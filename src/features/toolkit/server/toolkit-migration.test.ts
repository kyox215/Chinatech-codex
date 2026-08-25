import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ArchiveArtifact = {
  archive_path: string;
  original_path: string;
  bytes: number;
  sha256: string;
  production_applied: boolean;
  other_environment_status: string;
  status: string;
  active_schema_implication: boolean;
};

type ArchiveManifest = {
  status: string;
  production_applied: boolean;
  other_environment_status: string;
  active_schema_implication: boolean;
  execution_policy: {
    prohibit_execution: boolean;
    prohibit_restoration: boolean;
    prohibit_old_timestamp_reuse: boolean;
  };
  whitespace_exception: {
    path: string;
    sha256: string;
    diagnostic: string;
    scope: string;
    all_other_untracked_files_must_be_clean: boolean;
    broad_skip_forbidden: boolean;
  };
  artifacts: ArchiveArtifact[];
};

const lineageAddedPaths = [
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/README.md",
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/MANIFEST.json",
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260806222149_authenticated_toolkit_library.sql",
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260807120000_inventory_product_lifecycle.sql",
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260807120100_inventory_product_lifecycle_enable.sql",
  "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/tests/inventory_product_lifecycle.sql",
  "supabase/migrations/20260804225445_seatable_current_repair_transactional_import.sql",
  "supabase/migrations/20260804230127_seatable_import_preferred_channel_enum_fix_static.sql",
] as const;

const whitespaceException = {
  path: "supabase/migrations/20260804230127_seatable_import_preferred_channel_enum_fix_static.sql",
  sha256: "6aebb597ff202f67aa8d4421a70b7fb47de589178f01d140d8bbcfd2330486a4",
  diagnostic: "new blank line at EOF",
} as const;

const repoRoot = process.cwd();
const manifest = JSON.parse(
  readFileSync(
    resolve(
      repoRoot,
      "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/MANIFEST.json",
    ),
    "utf8",
  ),
) as ArchiveManifest;
const migration = readFileSync(
  resolve(
    repoRoot,
    "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/migrations/20260806222149_authenticated_toolkit_library.sql",
  ),
  "utf8",
);
const archiveReadme = readFileSync(
  resolve(
    repoRoot,
    "docs/migration-lineage/archive/TASK-20260823-002-repo-only-unapplied/README.md",
  ),
  "utf8",
);

describe("authenticated toolkit migration guardrails", () => {
  it("keeps repo-only lineage artifacts hashed, inactive and evidence-only", () => {
    expect(manifest.status).toBe("evidence_only");
    expect(manifest.production_applied).toBe(false);
    expect(manifest.other_environment_status).toBe("unknown");
    expect(manifest.active_schema_implication).toBe(false);
    expect(manifest.execution_policy.prohibit_execution).toBe(true);
    expect(manifest.execution_policy.prohibit_restoration).toBe(true);
    expect(manifest.execution_policy.prohibit_old_timestamp_reuse).toBe(true);
    expect(manifest.artifacts).toHaveLength(4);
    expect(archiveReadme).toMatch(
      /The archived lifecycle pgTAP file is static review evidence only and MUST NOT\s+be executed on any disposable, staging, or other database\./,
    );
    expect(archiveReadme).toMatch(
      /Any future runnable\s+lifecycle test must be newly authored and reviewed under separate approval\./,
    );

    for (const artifact of manifest.artifacts) {
      const archivePath = resolve(repoRoot, artifact.archive_path);
      const activePath = resolve(repoRoot, artifact.original_path);
      const contents = readFileSync(archivePath);

      expect(existsSync(archivePath)).toBe(true);
      expect(existsSync(activePath)).toBe(false);
      expect(contents.byteLength).toBe(artifact.bytes);
      expect(createHash("sha256").update(contents).digest("hex")).toBe(artifact.sha256);
      expect(artifact.production_applied).toBe(false);
      expect(artifact.other_environment_status).toBe("unknown");
      expect(artifact.status).toBe("evidence_only");
      expect(artifact.active_schema_implication).toBe(false);
    }
  });

  it("allows only the exact production EOF diagnostic and rejects broad whitespace skips", () => {
    const exception = manifest.whitespace_exception;
    expect(lineageAddedPaths).toHaveLength(8);
    expect(new Set(lineageAddedPaths).size).toBe(8);
    expect(exception.path).toBe(whitespaceException.path);
    expect(exception.sha256).toBe(whitespaceException.sha256);
    expect(exception.diagnostic).toBe(whitespaceException.diagnostic);
    expect(exception.scope).toBe("exact path and exact SHA-256 only");
    expect(exception.all_other_untracked_files_must_be_clean).toBe(true);
    expect(exception.broad_skip_forbidden).toBe(true);

    const diagnosticPaths: string[] = [];
    for (const targetPath of lineageAddedPaths) {
      expect(existsSync(resolve(repoRoot, targetPath))).toBe(true);
      const check = spawnSync("git", ["diff", "--no-index", "--check", "/dev/null", targetPath], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      const output = `${check.stdout}${check.stderr}`;
      const hasWhitespaceDiagnostic =
        check.status === 3 && /(?:trailing whitespace|blank line at EOF)/i.test(output);

      if (hasWhitespaceDiagnostic) diagnosticPaths.push(targetPath);
      if (targetPath === exception.path) {
        expect(
          createHash("sha256")
            .update(readFileSync(resolve(repoRoot, targetPath)))
            .digest("hex"),
        ).toBe(whitespaceException.sha256);
        expect(check.status).toBe(3);
        expect(output).toContain(whitespaceException.diagnostic);
      } else {
        expect(check.status).not.toBe(3);
        expect(output).not.toMatch(/(?:trailing whitespace|blank line at EOF)/i);
      }
    }

    expect(diagnosticPaths).toEqual([exception.path]);
  });

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
