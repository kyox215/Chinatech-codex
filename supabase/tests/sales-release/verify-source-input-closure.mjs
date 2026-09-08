// File-system-only package check: no Docker, database connection, or SQL execution.
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const artifacts = join(root, "artifacts/product-sales-transactions-20260907");
mkdirSync(artifacts, { recursive: true });
const scratch = mkdtempSync(join(artifacts, "input-closure-"));
try {
  const clean = join(scratch, "checkout");
  const tests = "supabase/tests/sales-release";
  mkdirSync(join(clean, tests), { recursive: true });
  mkdirSync(join(clean, "supabase/migrations"), { recursive: true });
  for (const file of readdirSync(join(root, tests), { withFileTypes: true })) {
    if (file.isFile()) copyFileSync(join(root, tests, file.name), join(clean, tests, file.name));
  }
  const migrations = [
    "20260907132641_inventory_sales_release_expand.sql",
    "20260907132655_inventory_sales_release_enable.sql",
  ];
  for (const file of migrations)
    copyFileSync(join(root, "supabase/migrations", file), join(clean, "supabase/migrations", file));
  assert.equal(
    existsSync(join(clean, "artifacts")),
    false,
    "clean checkout must have no pre-existing artifacts",
  );
  const visited = new Set();
  const inputs = new Set();
  function walk(path) {
    if (visited.has(path)) return;
    visited.add(path);
    assert.ok(existsSync(join(clean, path)), `missing source script ${path}`);
    const syntax = spawnSync("bash", ["-n", join(clean, path)], { cwd: clean, encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
    const source = readFileSync(join(clean, path), "utf8");
    for (const match of source.matchAll(/\bbash (supabase\/tests\/sales-release\/[\w.-]+\.sh)/g))
      walk(match[1]);
    for (const match of source.matchAll(/(?:<|\bnode)\s+["']?(supabase\/[\w./-]+)/g)) {
      assert.ok(existsSync(join(clean, match[1])), `missing source input ${match[1]}`);
      inputs.add(match[1]);
    }
  }
  walk("supabase/tests/sales-release/run-pg17.sh");
  const fresh = readFileSync(join(clean, tests, "run-pg17.sh"), "utf8");
  assert.ok(fresh.includes('generate-read-verification.mjs --out-dir "$inputs"'));
  assert.ok(fresh.includes('validate-pg17-read-race.sh "$db" "$inputs"'));
  assert.ok(fresh.includes('verify-pg17-source.sh "$db" "$inputs"'));
  assert.ok(
    !fresh.includes("--update-list"),
    "historical list recovery is not part of the fresh chain",
  );
  for (const script of ["validate-pg17-read-race.sh", "verify-pg17-source.sh"]) {
    const content = readFileSync(join(clean, tests, script), "utf8");
    assert.ok(
      content.includes("generate-read-verification.mjs"),
      `${script} standalone call must derive its own inputs`,
    );
    assert.ok(
      !/<\s+artifacts\//.test(content),
      `${script} cannot read a pre-existing artifact input`,
    );
  }
  const generator = join(clean, tests, "generate-read-verification.mjs");
  const generatorSyntax = spawnSync(process.execPath, ["--check", generator], { encoding: "utf8" });
  assert.equal(generatorSyntax.status, 0, generatorSyntax.stderr);
  const unrelatedCwd = join(scratch, "empty-working-directory");
  mkdirSync(unrelatedCwd);
  function generate(output) {
    const result = spawnSync(process.execPath, [generator, "--out-dir", output], {
      cwd: unrelatedCwd,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readdirSync(output).sort(), [
      "pg17-read-race-instrument.sql",
      "pg17-read-race-restore.sql",
      "pg17-source-parity.sql",
    ]);
  }
  const output = join(clean, "artifacts/product-sales-transactions-20260907/generated-inputs");
  generate(output);
  const restore = readFileSync(join(output, "pg17-read-race-restore.sql"), "utf8");
  const instrument = readFileSync(join(output, "pg17-read-race-instrument.sql"), "utf8");
  const parity = readFileSync(join(output, "pg17-source-parity.sql"), "utf8");
  assert.ok(
    !restore.includes("pg_advisory_xact_lock(71420260907)"),
    "restore must exclude synthetic hook",
  );
  assert.ok(instrument.includes("pg_advisory_xact_lock(71420260907)"));
  assert.equal(
    [...parity.matchAll(/\$source\$/g)].length,
    20,
    "parity must include exactly ten source bodies",
  );
  const migration = join(clean, "supabase/migrations", migrations[0]);
  const source = readFileSync(migration, "utf8");
  const anchor = "declare missing text[]:='{}';cellular boolean;";
  assert.ok(source.includes(anchor));
  writeFileSync(migration, source.replace(anchor, `${anchor}\n-- synthetic-generator-probe`));
  const changedOutput = join(scratch, "changed-source-output");
  generate(changedOutput);
  for (const file of readdirSync(changedOutput))
    assert.ok(
      readFileSync(join(changedOutput, file), "utf8").includes("synthetic-generator-probe"),
      `${file} must derive from current candidate source`,
    );
  process.stdout.write(
    `PASS: ${visited.size} default-chain shell scripts parsed; ${inputs.size} source input paths resolved; 3 SQL inputs generated with no prior artifacts from unrelated cwd; changed source propagated to all generated inputs. No SQL executed.\n`,
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
