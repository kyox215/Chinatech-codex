---
schema_version: 1
task_id: "TASK-20260619-023"
title: "L2-019 order-list legacy route migration implementation contract"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "FE", "INT", "QA"]
created_at: "2026-06-19T21:45:13Z"
updated_at: "2026-06-19T21:50:29Z"
closed_at: "2026-06-19T21:50:29Z"
---
# Task — L2-019 order-list legacy route migration implementation contract

## Owner request

L2-019 order-list legacy route migration implementation contract

## Business value

Turn the current legacy order-list route into an implementation-ready migration contract so the next code task can remove the only live @/routes dependency with clear file ownership, slices, validation, and rollback.

## Scope in

- Read-only audit of the current `src/routes/orders.index.tsx` implementation.
- Map imports, local components, hooks, API calls, query keys, UI sections, side effects, and existing reusable feature-owned files.
- Produce an implementation-ready migration contract for a later code task.
- Update task evidence, checkpoints, handoff, project memory, architecture/documentation department memory, backlog, and open-conflict records.
- Run governance validation for this docs/planning task.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Business code edits under `src/`, dependency changes, route deletion, staging, commit, push, deploy, production data work, or behavior changes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current src/routes/orders.index.tsx structure, imports, hooks, API/data flows, UI sections, and side effects are mapped with evidence.
- [x] A phased implementation contract identifies target feature-owned files, ownership, allowed changes, forbidden changes, tests, rollback, and pause conditions.
- [x] No business code, dependency, production, staging, commit, push, deploy, or route deletion action is performed.
- [x] Backlog/conflict/project/architecture/documentation/task memory are updated with the implementation-ready next step.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Active context was idle after L2-018 | verified fact | `.ai-company/memory/ACTIVE_CONTEXT.md` | create a new task before work |
| `CONFLICT-20260619-004` remains open and identifies order list as the only live legacy route dependency | verified fact | `.ai-company/memory/OPEN_CONFLICTS.md`; `TASK-20260619-022` | prepare implementation contract |
| `src/routes/orders.index.tsx` is 1826 lines and exports default `OrdersListPage` | verified fact | `wc -l`; structure scan | map into slices |
| `src/features/orders/screens/order-list-screen.tsx` is a 5-line wrapper importing `@/routes/orders.index` | verified fact | file read | later implementation removes this import |
| Existing feature-owned assets include `OrderMobileCard`, `OrderListPrintSheet`, `OrderDetailScreen`, `NewOrderScreen`, and `ordersKeys` | verified fact | file reads and line counts | reuse in plan |
| This task is planning-only R1/L2 | verified fact | owner boundary and scope-out | no business code changes |

## Decision and approval points

- No owner decision required for read-only code audit and memory/docs planning updates.
- Owner approval or a clear "start code implementation" instruction is required before modifying business code for the order-list migration because earlier takeover work preserved a no-business-code boundary.
- Owner approval remains required for route deletion, dependency changes, production data, staging, commit, push, deploy, or external/customer-facing actions.

## Work packages

- WP1: Context rehydrate and risk classification.
- WP2: Read-only source structure and dependency audit.
- WP3: Implementation contract with phased work packages, file ownership, validation, rollback, and pause conditions.
- WP4: Memory/documentation sync and governance validation.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
