import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const childChecks = [
  "scripts/agents/check-agent-config.mjs",
  "scripts/agents/check-agent-templates.mjs",
];

const staleStackTerms = [
  "TanStack Start v1",
  "@tanstack/react-router",
  "createFileRoute",
  "src/routes/",
  "Lovable Cloud",
  "Vite 7",
];

const filesToScan = [
  "AGENTS.md",
  "AI智能部门管理/部门化管理设计.md",
  ".agents/README.md",
  ".agents/repairdesk-multiagent.yaml",
  ".agents/decision-flow.md",
  ".agents/task-package-template.md",
  ".cursor/rules/00-overview.mdc",
  ".cursor/rules/20-layout-shell.mdc",
  ".cursor/rules/30-components.mdc",
  ".cursor/rules/40-page-recipes.mdc",
  ".cursor/rules/60-stack-conventions.mdc",
];

const errors = [];

for (const check of childChecks) {
  const result = spawnSync(process.execPath, [check], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    errors.push(`Child agent check failed: ${check}`);
  }
}

for (const file of filesToScan) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const term of staleStackTerms) {
    if (content.includes(term)) {
      errors.push(`Stale stack term "${term}" found in ${file}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Agent rule check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Agent rule check passed.");
