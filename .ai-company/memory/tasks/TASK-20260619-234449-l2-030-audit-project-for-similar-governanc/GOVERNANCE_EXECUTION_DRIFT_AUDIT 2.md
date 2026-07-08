# Governance Execution Drift Audit

- Task: `TASK-20260619-234449-l2-030-audit-project-for-similar-governanc`
- Mode: read-only governance audit
- Risk/autonomy: R1 / L2
- Scope: project rules, `.agents` templates/config/schemas/checkers, AI Company OS task memory, active docs, and formal memory.
- Out of scope: business code fixes, schema/code edits, production data, deployment, commit, push, or destructive cleanup.

## No-Spawn Reason

No sub-agents were spawned for this audit because the latest Owner request asked for a project check but did not explicitly request departments, sub-agents, or parallel AI employees in this turn; the current available multi-agent tool policy requires explicit user request before spawning. Department-style review was simulated by the main Integration Lead only and is marked as not spawned.

## Executive Conclusion

The original L2-029 issue is fixed at the main authority level: Owner-requested departments now require real Codex sub-agent spawning or a no-spawn reason.

However, similar governance execution drift still exists in several supporting surfaces. The highest-risk pattern is:

1. Root/YAML rules require a behavior.
2. Markdown templates or schemas do not carry the same required fields.
3. `npm run agents:check` still passes because its checks only validate older snippets or JSON parseability.

No P0 issues were found. The current issues are P1/P2 governance risks, not business-code defects.

## Verified Issues

| ID | Priority | Finding | Evidence | Impact | Recommended next task |
|---|---|---|---|---|---|
| GED-001 | P1 | Sub-agent task package contract is split across surfaces. `.agents/repairdesk-multiagent.yaml` requires `codex_agent`, `spawn_required`, `spawn_status`, and `fallback_reason_if_not_spawned`; `.agents/task-package-template.md` has those fields; `.agents/schemas/task-package.schema.json` does not allow or require them because `additionalProperties` is false; `AI智能部门管理/templates/subagent-task-package.md` is still the old contract. | `.agents/repairdesk-multiagent.yaml:73-88`; `.agents/task-package-template.md:5-30`; `.agents/schemas/task-package.schema.json:5-41`; `AI智能部门管理/templates/subagent-task-package.md:3-24` | A future package that follows the new real-spawn rule can fail schema validation, while an old package without spawn evidence can still pass current template checks. | L2-031: update task-package schema, Chinese subagent template, and agent template checker to require real-spawn fields. |
| GED-002 | P1 | Screenshot/no-screenshot evidence rule is in root/project task flow, but integration report template/schema and run-log template do not have structured screenshot evidence fields. | `AGENTS.md:64-72`; `.ai-company/policies/TASK_FLOW.md:252-260,281-300`; `AI智能部门管理/templates/integration-report.md:24-36`; `.agents/schemas/integration-report.schema.json:41-57`; `.agents/run-log-template.md:45-54` | Future final reports can omit visual evidence even while formal rules say it is mandatory. This weakens Owner verification for UI/result tasks. | L2-032: add `screenshots`, `no_screenshot_reason`, and `alternate_evidence` fields to integration report template/schema/run-log and checker snippets. |
| GED-003 | P1 | `npm run agents:check` is green but does not validate the new real-spawn or screenshot fields. `check-agent-templates.mjs` checks only old minimal snippets; `check-agent-config.mjs` only checks required files/snippets and JSON parseability for schemas. | `scripts/agents/check-agent-templates.mjs:5-30`; `scripts/agents/check-agent-config.mjs:23-67,88-98`; `scripts/check-agent-rules.mjs:4-63`; command `npm run agents:check` passed | The main governance gate can create false confidence after rule changes, exactly the class of error found in L2-029. | Combine with L2-031/L2-032: make checker assert contract parity across YAML, Markdown templates, and JSON schemas. |
| GED-004 | P1 | Some task memories are not machine-standard task records. `ai_company.py list-tasks` reports `? ? ?` for at least `TASK-20260620-001-orders-ui-export` and `TASK-20260620-004-fault-description-sheet`; a custom frontmatter scan found missing standard keys in 4 task files. | `tools/ai_company.py list-tasks`; read-only Node frontmatter scan; `TASK-20260620-004-fault-description-sheet/TASK.md:1-34`; `TASK-20260620-001-orders-ui-export/TASK.md:1-35`; `TASK-20260620-001/TASK.md:1-12`; `TASK-20260620-014006-repairdesk-figma-ui-system/TASK.md:1-9` | Task status/risk/autonomy can become invisible to project tooling, making resume/closeout and governance audits less reliable. | L2-033: normalize nonstandard task frontmatter without changing business artifacts. |
| GED-005 | P2 | One non-current task is still marked active: `TASK-20260620-014006-repairdesk-figma-ui-system`, while `ACTIVE_CONTEXT.md` points to the current L2-030 audit. This may be legitimate cross-thread work, but it is not represented as on-hold or explicitly parallel in active context. | `TASK-20260620-014006-repairdesk-figma-ui-system/TASK.md:1-9`; `.ai-company/memory/ACTIVE_CONTEXT.md:1-12`; `tools/ai_company.py list-tasks` | Future "continue" could be ambiguous if multiple tasks remain active. | Ask Owner whether to resume, close, or mark the Figma task on-hold. |
| GED-006 | P2 | Department memories still contain template placeholders in interface/capability sections. `memory-audit` reports 12 department files with `TBD` placeholders. | `/opt/homebrew/bin/python3.12 tools/ai_company.py memory-audit`; `rg -n "TBD|Not initialized|unknown until inspected" .ai-company/memory/departments`; examples: `.ai-company/memory/departments/qa.md:53-57,86-90`; `.ai-company/memory/departments/product.md:35-39,60-64` | The project says formal department memory is initialized, but some structured sections are still placeholders. This is low immediate risk because rules/risks are populated, but interface/capability records are incomplete. | L2-034: replace placeholder rows with explicit `not_defined_yet` records or real interfaces/capability profiles. |
| GED-007 | P2 | Some active-looking docs still contain stale legacy-route examples that are not covered by `agents:check`. `docs/DESIGN_SYSTEM.md` says App Router is the route standard but still references `src/routes/index.tsx` as a dashboard recipe; `docs/CODEX_REPLICATION_GUIDE.md` describes `src/routes` as migrated page client bodies. | `docs/DESIGN_SYSTEM.md:37-39,160-170`; `docs/CODEX_REPLICATION_GUIDE.md:1-33`; `docs/ARCHITECTURE.md` currently says `src/routes/` is legacy compatibility debt; `scripts/check-agent-rules.mjs:18-30` scans only selected agent/root files for stale stack terms | Future UI generation could copy stale examples from active-looking docs, despite current App Router rules. | L2-035: classify `DESIGN_SYSTEM.md` and `CODEX_REPLICATION_GUIDE.md` as active vs snapshot; refresh or banner them. |

## False Positives / Already Covered

| Candidate | Result | Evidence |
|---|---|---|
| Real Codex agent profiles missing | Not found. YAML mapped agents exist in `.codex/agents/*.toml`; `npm run agents:config` passed. | `.codex/agents/*`; `.agents/repairdesk-multiagent.yaml:192-248`; `npm run agents:config` |
| L2-029 real sub-agent rule itself | Fixed at authority surfaces and task evidence. | `AGENTS.md:52-56`; `.agents/integration-checklist.md:13-14,79`; `TASK-20260619-232915.../EVIDENCE.md` |
| Legacy route references in `docs/ARCHITECTURE.md` | Not a bug by itself. They are framed as legacy cleanup debt and Owner-approved deletion boundary. | `docs/ARCHITECTURE.md:56-67`; `OPEN_CONFLICTS.md` CONFLICT-20260619-004 |
| `.ai-company/runtime-memory` paths | Not a current task-memory target. They are retained as legacy trace-only memory. | `AGENTS.md:8`; `AI智能部门管理/部门化管理设计.md:90`; `AI智能部门管理/templates/agenda-intake.md:39` |

## Unknowns

| Item | Why unknown | Next verification |
|---|---|---|
| Whether the Figma task should remain active | It may belong to a different active thread, but current `ACTIVE_CONTEXT.md` has only one current task pointer. | Owner or thread coordination decision: resume, close, or mark on-hold. |
| Whether JSON schemas are used by any external validator beyond parse checks | Current repo checker only parses schemas; no schema-instance validation was found in this audit. | Search CI or future PR tooling before changing schema behavior. |
| Whether all historical task records should be normalized | Some older tasks may be intentionally lightweight, but tooling now expects v3 frontmatter. | Normalize only after verifying each task's closeout evidence. |

## Validation Commands Run

- `npm run agents:config` — passed.
- `npm run agents:check` — passed, while audit still found checker coverage gaps.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py memory-audit` — 0 metadata issues, 12 department files with template placeholders, OPEN_CONFLICTS notice.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate --report .ai-company/memory/tasks/TASK-20260619-234449-l2-030-audit-project-for-similar-governanc/AI_COMPANY_VALIDATE_REPORT.md` — passed, 11 checks / 0 warnings / 0 errors.
- Targeted `rg`, `nl`, `find`, `sed`, and read-only Node scans listed in `EVIDENCE.md`.

## No Screenshot Reason

No related app UI, browser-visible task page, or preview result was changed or inspected as a final user-facing feature. This audit is docs/rules/memory/checker inspection only. Alternate evidence is this report, exact file/line references, command outputs, and the generated validation report.

## Recommended Batch Order

1. L2-031: fix sub-agent package contract parity: YAML, `.agents/task-package-template.md`, `AI智能部门管理/templates/subagent-task-package.md`, `.agents/schemas/task-package.schema.json`, and template/config checks.
2. L2-032: fix screenshot evidence contract parity: integration report template/schema/run log/checker.
3. L2-033: normalize nonstandard task memory frontmatter and decide the active Figma task status.
4. L2-034: replace department memory placeholders with explicit real interfaces or `not_defined_yet` records.
5. L2-035: refresh or archive/banner stale active-looking docs with legacy route examples.
