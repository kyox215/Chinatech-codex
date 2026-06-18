import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "AGENTS.md",
  "AI智能部门管理/部门化管理设计.md",
  "AI智能部门管理/departments.yml",
  ".agents/README.md",
  ".agents/repairdesk-multiagent.yaml",
  ".agents/decision-flow.md",
  ".agents/department-roster.md",
  ".agents/task-package-template.md",
  ".agents/integration-checklist.md",
  ".agents/run-log-template.md",
  ".agents/route-cases.yaml",
  ".agents/runs/2026-06-18-multiagent-baseline.md",
  ".agents/examples/readonly-audit.md",
  ".agents/examples/scoped-write-worker.md",
  ".agents/examples/multi-department-review.md",
  ".agents/schemas/task-package.schema.json",
  ".agents/schemas/integration-report.schema.json",
];

const requiredSnippets = [
  {
    file: "AGENTS.md",
    snippets: ["Integration Lead", "Sub-agents report blockers"],
  },
  {
    file: "AI智能部门管理/部门化管理设计.md",
    snippets: [
      ".agents/decision-flow.md",
      "decision_owner: Integration Lead",
      "子代理不得直接向用户请求扩大权限",
    ],
  },
  {
    file: ".agents/README.md",
    snippets: ["Decision Owner Flow", "Sub-agents report blockers"],
  },
  {
    file: ".agents/repairdesk-multiagent.yaml",
    snippets: [
      "decision_owner:",
      "routing_matrix:",
      "assignment_contract:",
      "task_lifecycle:",
      "handoff_contracts:",
      "debate_protocol:",
    ],
  },
  {
    file: ".agents/decision-flow.md",
    snippets: ["Single Entry", "Batch Execution", "Debate And Arbitration"],
  },
  {
    file: ".agents/route-cases.yaml",
    snippets: [
      "customer_search_or_customer_loading",
      "order_workflow_or_payment",
      "buyback_quote_flow",
    ],
  },
  {
    file: ".agents/runs/2026-06-18-multiagent-baseline.md",
    snippets: ["run_id: 2026-06-18-multiagent-baseline", "Safe Commit Scope", "Next Pilot Task"],
  },
  {
    file: "AI智能部门管理/部门化管理设计 2.md",
    snippets: ["Deprecated / 非权威旧版"],
  },
];

const readText = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    errors.push(`Missing required agent config file: ${file}`);
  }
}

for (const { file, snippets } of requiredSnippets) {
  const content = readText(file);
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`Missing required agent snippet "${snippet}" in ${file}`);
    }
  }
}

for (const schemaFile of [
  ".agents/schemas/task-package.schema.json",
  ".agents/schemas/integration-report.schema.json",
]) {
  if (!existsSync(schemaFile)) continue;
  try {
    JSON.parse(readText(schemaFile));
  } catch (error) {
    errors.push(`Invalid JSON schema ${schemaFile}: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error("Agent config check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Agent config check passed.");
