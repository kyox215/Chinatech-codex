---
schema_version: 1
task_id: "TASK-20260619-019"
title: "L2-015 active documentation fix batch A"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "MEM", "QA"]
created_at: "2026-06-19T21:20:21Z"
updated_at: "2026-06-19T21:22:45Z"
closed_at: "2026-06-19T21:22:45Z"
---
# Task — L2-015 active documentation fix batch A

## Owner request

L2-015 active documentation fix batch A

## Business value

Remove the two highest-risk active documentation drifts so future AI employees use App Router and v3 task memory paths.

## Scope in

- Update `docs/UI_CHECKLIST.md` route/metadata checklist to match Next.js App Router and feature-screen ownership.
- Update `AI智能部门管理/templates/agenda-intake.md` task-memory path guidance to `.ai-company/memory/tasks/<task_id>/` and mark `.ai-company/runtime-memory/` as legacy trace-only.
- Preserve existing user/worktree changes in the same files and avoid unrelated wording changes.
- Update task evidence, checkpoints, handoff, and formal project/documentation memory.

## Scope out

- Business code, UI implementation, API/data files, dependencies, migrations, generated output, production configuration, staging, commits, pushes, deploys, or customer-facing operations.
- Archive banner work for TanStack export/planning docs.
- Broad documentation metadata convention.
- Legacy route migration implementation.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] docs/UI_CHECKLIST.md no longer instructs new route files to live under src/routes.
- [x] AI智能部门管理/templates/agenda-intake.md no longer instructs non-micro task memory to use .ai-company/runtime-memory/tasks.
- [x] No business code, dependency, production, staging, commit, push, or deploy action is performed.
- [x] Task memory, project/documentation memory, conflict/backlog records, and evidence are updated.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| L2-015 task exists and is active | verified fact | `TASK.md`; `.ai-company/memory/ACTIVE_CONTEXT.md` | active until closeout |
| L2-014 identified the two P1 active doc drift targets | verified fact | `TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | this task fixes batch A |
| `docs/UI_CHECKLIST.md` route guidance pointed to `src/routes/` | verified fact | pre-edit file line 22 | fixed in this task |
| `AI智能部门管理/templates/agenda-intake.md` memory guidance pointed to `.ai-company/runtime-memory/tasks` | verified fact | pre-edit file line 39; existing local diff | fixed in this task |
| `AI智能部门管理/templates/agenda-intake.md` had pre-existing local modifications | observed boundary | `git diff -- AI智能部门管理/templates/agenda-intake.md` before edit | preserved; only stale path line changed |

## Decision and approval points

- R1/L2: active documentation text only, reversible, no business-code or production effect.
- Decision: fix only the two P1 active doc drift lines in this batch; leave archive labels and metadata convention to separate backlog tasks.

## Work packages

- Intake and risk classification: complete.
- Pre-edit evidence and dirty-worktree boundary: complete.
- Two-line active documentation fix: complete.
- Validation: complete.
- Memory sync: complete.
- Closeout: pending.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
