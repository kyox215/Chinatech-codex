---
schema_version: 1
task_id: "TASK-20260704-001-order-supplier-embed-incident"
title: "Fix order page supplier embed incident"
status: "complete"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Data/API", "Frontend", "QA"]
created_at: "2026-07-03T23:35:39Z"
updated_at: "2026-07-03T23:36:37Z"
---
# Task — Fix order page supplier embed incident

## Owner request

Fix order page supplier embed incident

## Business value

Restore /orders queue information cards and order list loading after adding the parts supplier relationship.

## Scope in

- Fix Supabase/PostgREST supplier embed ambiguity in order list/detail selects.
- Verify production `repair_orders` -> `suppliers` foreign key names.
- Add a regression test covering the explicit supplier relationship selector.
- Record evidence for tests, typecheck, lint, and production DB relationship inspection.

## Scope out

- Removing or changing the production `parts_supplier_id` relationship.
- Running broad migration history repair or `supabase db push --include-all`.
- Unrelated order UI redesign or card layout changes.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Orders queue summary no longer uses an ambiguous repair_orders/suppliers relationship.
- [x] Production database relationship names are verified before changing the select embed.
- [x] Regression test prevents ambiguous supplier embeds from returning.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | observed | `src/server/repairdesk-shared.ts` | repaired select strings |
| Production supplier relationships | observed | Supabase read-only constraint query | two FKs require explicit embed selector |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.

## Closeout

- Root cause: `repair_orders` now has both `supplier_id` and `parts_supplier_id` relationships to `suppliers`, so PostgREST rejected `supplier:suppliers(*)` as ambiguous.
- Fix: `ORDER_SELECT`, `ORDER_LIST_SELECT`, and `ORDER_LIST_LEGACY_SELECT` now use `supplier:suppliers!repair_orders_supplier_id_fkey(*)`.
- Database finding: production constraints are `repair_orders_supplier_id_fkey` and `repair_orders_parts_supplier_same_store_fkey`; no additional migration was needed for this incident.
- Verification: focused tests, typecheck, lint, and production read-only FK inspection passed.
