---
schema_version: 1
task_id: "TASK-20260619-022"
title: "L2-018 legacy route migration plan refresh"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "INT", "QA"]
created_at: "2026-06-19T21:33:31Z"
updated_at: "2026-06-19T21:41:45Z"
closed_at: "2026-06-19T21:41:45Z"
---
# Task — L2-018 legacy route migration plan refresh

## Owner request

L2-018 legacy route migration plan refresh

## Business value

Refresh the legacy route migration plan from current code facts so future order-list work targets the only remaining live @/routes dependency.

## Scope in

- Inventory current `src/routes` files and live `@/routes` imports.
- Refresh the active architecture migration plan from current repository facts.
- Update task evidence, project memory, architecture memory, documentation memory, backlog, and open-conflict records.
- Run the docs/rules validation gate for this governance-only task.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.
- Business code changes, dependency changes, route deletion, staging, commit, push, deploy, or production data actions.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Current src/routes files and live imports are inventoried with evidence.
- [x] Active architecture docs or task report state the current migration plan without claiming dashboard still wraps a legacy route unless verified.
- [x] No business code, dependency, production, staging, commit, push, or deploy action is performed.
- [x] Project/architecture/documentation memory, backlog/conflict records, and evidence are updated.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner asked to continue next step under the governance sequence | verified fact | chat instruction; `TASK.md` | proceed as L2 docs/rules task |
| Current legacy route files are `src/routes/orders.tsx`, `src/routes/messages.tsx`, `src/routes/orders.index.tsx`, `src/routes/inventory.tsx`, `src/routes/index.tsx`, and `src/routes/settings.tsx` | verified fact | `rg --files src/routes` | record inventory |
| The only verified live `@/routes` import under scanned active source is `src/features/orders/screens/order-list-screen.tsx` importing `@/routes/orders.index` | verified fact | source scan in `EVIDENCE.md` | keep conflict open until code migration |
| No current dashboard `@/routes/index` import was found in active `src` scan | verified fact | source scan in `EVIDENCE.md` | update stale planning language |
| `CONFLICT-20260619-004` remains open because the order-list dependency still exists | verified fact | `.ai-company/memory/OPEN_CONFLICTS.md`; source scan | refresh interim rule, do not close |
| This task is R1/L2 governance/documentation work | verified fact | acceptance criteria and scope-out | no business code or destructive actions |

## Decision and approval points

- No owner decision required for docs/rules/memory updates inside L2.
- Owner approval is required before deleting `src/routes/*`, changing order-list behavior, changing dependencies, staging/committing/pushing, deploying, or touching production data.

## Work packages

- WP1: Intake and route/import evidence.
- WP2: Architecture migration plan refresh.
- WP3: Project, department, backlog, conflict, and task memory sync.
- WP4: Governance validation and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
