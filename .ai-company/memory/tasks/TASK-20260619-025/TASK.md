---
schema_version: 1
task_id: "TASK-20260619-025"
title: "L2-021 migrate order list out of legacy route"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["ARCH", "DOC", "FE", "INT", "QA"]
created_at: "2026-06-19T21:59:46Z"
updated_at: "2026-06-19T22:15:00Z"
closed_at: "2026-06-19T22:13:20Z"
---
# Task — L2-021 migrate order list out of legacy route

## Owner request

L2-021 migrate order list out of legacy route

## Business value

Remove the only live @/routes dependency by moving order-list behavior into feature-owned files while preserving existing order-list behavior.

## Scope in

- Move the live order list implementation out of the legacy `@/routes/orders.index` wrapper.
- Keep active App Router behavior under `src/features/orders/screens/order-list-screen.tsx`.
- Extract order-list presentational pieces and CSV export logic into feature-owned files.
- Add focused unit coverage for order-list CSV export behavior.
- Keep `src/routes/*` files in place for a later explicit cleanup task.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] src/features/orders/screens/order-list-screen.tsx no longer imports @/routes/orders.index.
- [x] rg -n "from \"@/routes|@/routes" src returns no active source hits.
- [x] Order-list behavior is preserved in code structure: search, workflow filters, filter sheet, desktop row/detail dialog, mobile cards, new order dialog, single/bulk transitions, print, CSV export, loading, empty, error, pagination were moved into feature-owned screen/components/model files.
- [x] Implementation follows TASK-20260619-023 file ownership: feature-owned screen/components/model/query-key files only; no src/routes deletion.
- [x] No dependency, API/server contract, Supabase, production data, staging, commit, push, deploy, payment, permission, tenant, or customer-communication changes are performed.
- [x] Validation runs: npm run lint, npm run typecheck, npm run test, npm run build; sandbox build failure was classified only after non-sandbox build passed.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| L2-020 baseline was green before code migration | verified fact | `TASK-20260619-024/ORDER_LIST_PRE_IMPLEMENTATION_BASELINE.md` | used as starting baseline |
| Only active `@/routes` dependency was the order-list wrapper before migration | verified fact | `TASK-20260619-022/LEGACY_ROUTE_MIGRATION_PLAN_REFRESH.md` and source scan | migration target confirmed |
| Active source now has no `@/routes` import hits | verified fact | `rg -n 'from "@/routes|@/routes' src` returned no output | acceptance satisfied |
| Legacy `src/routes/*` files still exist | verified fact | task constraint and git/source state | cleanup intentionally deferred |
| Browser/manual UI exercise was not run in this task | known limitation | validation log | rely on code move plus lint/typecheck/unit/build gates; add browser smoke in later UI cleanup if desired |

## Decision and approval points

- Owner's repeated "continue next step" after L2-020 was treated as L2 authorization for the bounded business-code migration.
- No approval was requested or used for production, data, dependency, deploy, destructive, payment, permission, or customer-communication actions.

## Work packages

- WP-1: Rehydrate order-list migration contract and baseline.
- WP-2: Extract legacy order-list implementation into feature-owned screen/components/model/query-key files.
- WP-3: Remove active `@/routes/orders.index` wrapper import and normalize order-list query keys.
- WP-4: Run lint, typecheck, tests, build, and source scans.
- WP-5: Synchronize task evidence, department memory, conflicts, backlog, and handoff.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
