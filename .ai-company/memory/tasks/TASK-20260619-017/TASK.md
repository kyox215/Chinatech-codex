---
schema_version: 1
task_id: "TASK-20260619-017"
title: "L2-013 task registry hygiene inventory"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["INT", "MEM", "QA"]
created_at: "2026-06-19T21:02:36Z"
updated_at: "2026-06-19T21:11:15Z"
closed_at: "2026-06-19T21:10:57Z"
---
# Task — L2-013 task registry hygiene inventory

## Owner request

L2-013 task registry hygiene inventory

## Business value

Make task memory status reliable after the duplicate-cleanup wave by inventorying active/on_hold/conditional/complete records and normalizing only low-risk historical status metadata.

## Scope in

- Inventory standard `.ai-company/memory/tasks/*/TASK.md` records after L2-012 active-context cleanup.
- Separate verified facts, assumptions, retained exceptions, and unknowns for task status memory.
- Normalize historical `status: "complete"` records to `status: "closed"` only when prior acceptance/checkpoints support that they were already finished.
- Preserve `conditional` and `on_hold` tasks without falsely closing them.
- Update task evidence, checkpoints, handoff, project memory, memory department memory, and conflict/risk records.

## Scope out

- Business code, UI, API, data model, migrations, dependencies, tests, generated output, and production configuration changes.
- Deleting files, staging, committing, pushing, deploying, or running production/customer-impacting operations.
- Closing intentionally conditional or on-hold task records without a separate owner-directed resume/closeout.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] All standard task records are inventoried with status, evidence count, checkpoint count, and recommended disposition.
- [x] Legacy complete tasks without closed_at are normalized only when evidence supports they are already finished historical records.
- [x] On-hold or conditional tasks are not falsely closed; each has a clear next action.
- [x] Project memory, memory department, conflict/risk records, evidence, checkpoints, and handoff are updated.
- [x] npm run agents:check passes after memory updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| L2-013 task exists and is current | verified fact | `TASK.md`; `.ai-company/memory/ACTIVE_CONTEXT.md` | closed; active context returned to idle |
| Pre-L2-013 standard task registry had 19 `TASK.md` records | verified fact | `find .ai-company/memory/tasks -maxdepth 2 -name TASK.md` before current task creation | used as historical scan baseline |
| Current standard task registry has 20 `TASK.md` records including L2-013 | verified fact | Python frontmatter/count scan | inventoried in `TASK_STATUS_REGISTRY_AUDIT.md` |
| Five historical tasks used legacy `status: "complete"` without `closed_at` | verified fact | frontmatter scan and checkpoint review | normalized to `closed` with inferred historical close timestamps |
| One task remains `conditional` | verified fact | `TASK-20260619-005/TASK.md` | preserved; no false closure |
| One task remains `on_hold` | verified fact | `TASK-20260619-202308-repairdesk-order-detail-and-cross-page-ui/TASK.md` | preserved; deliberate resume only |
| Legacy `TASK_MEMORY.md` record exists outside the standard `TASK.md` registry | verified fact | `MEMORY_INDEX.md` | left untouched; no status migration in this task |
| Dirty worktree includes existing governance-memory files | verified fact | `git status --short` scoped to memory files | no staging/commit/push in this task |

## Decision and approval points

- R1/L2: governance-memory metadata only, reversible, no business code or production effect.
- Decision: use `closed`, `conditional`, and `on_hold` as durable task status vocabulary; stop using historical `complete` for closeout frontmatter.
- Decision: preserve conditional/on-hold exceptions with explicit next actions instead of forcing a clean-looking registry.

## Work packages

- Intake and risk classification: complete.
- Registry scan and evidence review: complete.
- Safe metadata normalization for five historical records: complete.
- Report, memory sync, and conflict register update: complete.
- Governance check: passed.
- Closeout: complete.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
