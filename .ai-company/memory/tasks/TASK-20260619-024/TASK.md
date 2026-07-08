---
schema_version: 1
task_id: "TASK-20260619-024"
title: "L2-020 order-list migration pre-implementation baseline gate"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "INT", "QA"]
created_at: "2026-06-19T21:52:40Z"
updated_at: "2026-06-19T21:57:21Z"
closed_at: "2026-06-19T21:57:21Z"
---
# Task — L2-020 order-list migration pre-implementation baseline gate

## Owner request

L2-020 order-list migration pre-implementation baseline gate

## Business value

Establish a current full-code validation baseline before the order-list legacy route migration so later implementation failures can be attributed accurately.

## Scope in

- Record the current dirty-worktree and migration-readiness context.
- Run implementation baseline gates for the upcoming order-list migration:
  `npm run agents:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Classify sandbox/environment failures separately from code failures.
- Produce a migration-readiness baseline report and update task/project/department memory.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Business code edits, dependency changes, route deletion, staging, commit, push, deploy, or production data work.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current dirty worktree and order-list migration context are recorded with evidence.
- [x] Pre-implementation baseline commands are run or explicitly classified if blocked: npm run agents:check, npm run lint, npm run typecheck, npm run test, npm run build.
- [x] Results distinguish code failures, pre-existing dirty-worktree risk, and environment-specific failures.
- [x] No business code, dependency, production, staging, commit, push, deploy, or route deletion action is performed.
- [x] Task evidence, checkpoints, project/QA/architecture/documentation memory, backlog/conflict records are updated with the migration readiness conclusion.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| L2-019 implementation contract is the current order-list migration guide | verified fact | `TASK-20260619-023/ORDER_LIST_MIGRATION_IMPLEMENTATION_CONTRACT.md` | use as baseline context |
| Earlier boundary still excludes business code without explicit implementation instruction | verified fact | L2-019 handoff and task scope | run validation only |
| Current worktree is already dirty | verified fact | `git status --short` | attribute results carefully |
| One active-source legacy import remains | verified fact | `rg -n 'from "@/routes|@/routes' src` | expected open debt |
| Governance, lint, typecheck, unit tests, and non-sandbox build passed | verified fact | command outputs in `EVIDENCE.md` | record readiness |
| Sandboxed build failed with Turbopack port-binding permission | verified fact | `npm run build` sandbox output | classify as environment-specific after non-sandbox pass |

## Decision and approval points

- No owner decision required for read-only/full-gate baseline validation.
- Owner approval or an explicit "start implementation" instruction is still required before editing order-list business code.
- Route deletion, dependency changes, production data, staging, commit, push, deploy, or external/customer-facing actions remain out of scope.

## Work packages

- WP1: Context rehydrate and task intake.
- WP2: Run baseline gates and classify failures.
- WP3: Write baseline readiness report and update memory.
- WP4: Close with implementation-readiness conclusion.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
