---
schema_version: 1
task_id: "TASK-20260619-232315-l2-028-require-closeout-screenshots-for-re"
title: "L2-028 require closeout screenshots for relevant task pages"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "QA"]
created_at: "2026-06-19T23:23:15Z"
updated_at: "2026-06-19T23:26:34Z"
closed_at: "2026-06-19T23:26:34Z"
---
# Task — L2-028 require closeout screenshots for relevant task pages

## Owner request

L2-028 require closeout screenshots for relevant task pages

## Business value

Make visual evidence mandatory after tasks so the Owner can see task results instead of only reading text reports.

## Scope in

- Add a project-level rule that task closeout must include screenshots of relevant task/result pages when UI or browser-visible output exists.
- Define no-screenshot fallback language for docs/backend/non-UI tasks.
- Update task-flow, project rules, integration checklist, task memory, and affected department memories.

## Scope out

- Business code, UI code, database migrations, dependencies, production data, deployment, staging, commit, push, or destructive actions.
- Requiring screenshots where no UI/result page exists; those tasks must instead record a no-screenshot reason and alternate evidence.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Project rules declare that after every task, the final report must include screenshots of relevant task/result pages when a UI or browser-visible result exists.
- [x] Rules define the fallback for docs/backend/non-UI tasks: explicitly state no relevant screenshot page exists and provide evidence paths/commands instead.
- [x] Task flow and closeout guidance require screenshot paths or a no-screenshot reason in evidence and final report.
- [x] Affected QA and documentation memories are synchronized.
- [x] No business code is modified.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner requested project declaration for screenshots after every task | verified fact | owner message | implement as project operating rule |
| This is rules/docs/memory work only | verified fact | scope and acceptance | no business code changes |
| Some tasks have no relevant UI page | assumption | docs/backend/data task patterns | require explicit no-screenshot reason and alternate evidence |
| Screenshots can expose sensitive data | known project risk | security/privacy rules | require no secrets/full PII in screenshots |

## Decision and approval points

- R1/L2: reversible governance/documentation change. No Owner approval beyond the direct instruction is required.
- If a future task cannot screenshot because login, service, browser, or privacy constraints block it, the agent must report the concrete reason and alternate evidence.

## Work packages

- Intake and risk classification: completed.
- Rule updates: completed in root rules, task flow, project rules, and integration checklist.
- Department/project memory sync: completed.
- Validation and closeout: ready.

## Validation results

| Gate | Evidence | Result |
|---|---|---|
| Screenshot-rule discovery | `rg -n "Visual Evidence|截图|screenshot|no-screenshot|无截图|Screenshots" ...` | passed; rule appears in root rules, task flow, project rules, integration checklist, project memory, QA/DOC memory, and task files |
| Governance gate | `npm run agents:check` | passed |
| Business-code boundary | task edits | no `src/`, `supabase/`, database migration, dependency, production, deployment, staging, commit, or push changes were made by this task |
| Screenshot for this task | task type | no related app/UI task page exists because this task only changes governance markdown/memory; alternate evidence is the rule file paths and validation commands above |

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
