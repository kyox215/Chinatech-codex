---
schema_version: 1
task_id: "TASK-20260709-018-order-load-customer-relationship"
status: "closed"
phase: "validating"
task_class: "T1"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
created_at: "2026-07-09T15:18:30Z"
updated_at: "2026-07-09T16:04:13Z"
closed_at: "2026-07-09T16:04:13Z"
---
# TASK-20260709-018-order-load-customer-relationship

## Owner Goal

Diagnose and fix the production `/orders` load failure shown in the mobile screenshot, then prevent similar Supabase relationship ambiguity from returning.

## Incident Statement

- Severity: customer-visible internal production outage for the orders list workflow.
- Symptom: `/orders` shows `工单加载失败` with PostgREST message `Could not embed because more than one relationship was found for 'repair_orders' and 'customers'`.
- Known impact: orders list cannot load through the affected query path.
- Commander: main Codex thread as RepairDesk Integration Lead.

## Scope

- Fix RepairDesk order Supabase selects that embed `customers` from `repair_orders`.
- Preserve store isolation by using the same-store foreign key relationship.
- Add regression coverage that rejects ambiguous `customer:customers(...)` embeds in order server queries.
- Verify with tests, typecheck, lint, build, source scan, and read-only production schema evidence.

## Out Of Scope

- Do not change production data.
- Do not run broad Supabase migration push while migration history remains divergent.
- Do not refactor unrelated order, customer, kiosk, or settings work.

## Department Agenda

- INT: incident command, scope, worktree isolation, release boundary.
- API: repair Supabase select strings.
- DATA: verify production FK ambiguity and choose stable relationship.
- SEC: preserve tenant/store isolation and avoid exposing secrets or PII.
- QA: add regression test and run gates.
- DOC: record incident evidence and handoff.

## Agent Plan

- Spawned agents: none.
- No-spawn reason: narrow production bug with three-file code ownership; creating sub-agents would add coordination overhead and risk exposing production/schema context without independent write benefit. Department review was performed by the main thread.

## Acceptance Criteria

- `repair_orders` queries do not use `customer:customers(...)` ambiguous embeds.
- Order customer embeds use `customers!repair_orders_customer_same_store_fkey`.
- Production schema evidence confirms multiple `repair_orders -> customers` FKs.
- Related unit tests, lint, typecheck, full test suite, and production build pass.
- Final report states database action and release boundary clearly.

## Rollback

- Revert the commit changing `src/server/repairdesk-shared.ts`, `src/features/orders/server/order.repository.ts`, and `src/server/repairdesk-shared.test.ts`.
- No schema rollback is needed because no DB writes or migrations are part of this fix.
