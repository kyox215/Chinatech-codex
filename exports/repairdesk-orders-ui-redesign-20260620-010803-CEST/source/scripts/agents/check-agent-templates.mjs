import { existsSync, readFileSync } from "node:fs";

const readText = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");

const templateRequirements = [
  {
    file: ".agents/task-package-template.md",
    snippets: ["task_id:", "owned_paths:", "handoff_to_integration_lead"],
  },
  {
    file: "AI智能部门管理/templates/agenda-intake.md",
    snippets: [
      "decision_owner: Integration Lead",
      "spawn_plan:",
      "file_ownership_plan:",
      "stop_condition:",
    ],
  },
  {
    file: "AI智能部门管理/templates/subagent-task-package.md",
    snippets: ["task_id:", "owned_paths:", "handoff_to_integration_lead"],
  },
  {
    file: "AI智能部门管理/templates/integration-report.md",
    snippets: ["decision_owner: Integration Lead", "file_ownership:", "role_simulation:"],
  },
  {
    file: ".agents/run-log-template.md",
    snippets: ["run_id:", "decision_owner: Integration Lead", "accepted:", "rejected:"],
  },
];

const errors = [];

for (const { file, snippets } of templateRequirements) {
  const content = readText(file);
  if (!content) {
    errors.push(`Missing agent template: ${file}`);
    continue;
  }
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`Missing required template snippet "${snippet}" in ${file}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Agent template check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Agent template check passed.");
