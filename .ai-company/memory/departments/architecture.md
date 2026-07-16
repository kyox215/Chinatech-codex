---
schema_version: 1
department: architecture
status: active
owner: Architecture Department / Integration Lead
last_verified_at: 2026-07-17
review_trigger: relevant-task-or-quarterly-review
---

# Architecture Department Memory

## Mission and boundary

System boundaries, public contracts, quality attributes, ADRs, dependencies, and migration strategy.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Preserve Next.js App Router plus feature-owned screen boundaries from `docs/ARCHITECTURE.md`.
- First priority: obtain Owner approval before deleting classified legacy `src/routes/*` files, and reduce high-blast-radius modules without reintroducing `@/routes` imports.

## Verified rules and conventions

- Route files belong under `src/app/` and should stay thin.
- Business UI belongs under `src/features/*`; shared helpers under `src/shared/lib`; client components must not import `src/server/*`.
- No active source currently imports `@/routes`; treat any new `@/routes` import as architecture drift unless it is part of an explicit cleanup/recovery task.
- `TASK-20260619-022` is the historical legacy route migration plan that identified the former order-list wrapper dependency; use `TASK-20260619-025` as the current implementation status.
- `TASK-20260619-023` is the implementation contract that `TASK-20260619-025` executed; keep it as context, not as proof of current remaining work.
- `TASK-20260619-024` is the pre-implementation validation baseline for the order-list migration.
- `TASK-20260619-025` implemented the feature-owned order-list migration and removed the active `@/routes/orders.index` dependency. Remaining `src/routes/*` files are cleanup debt and must not be deleted outside a separate scoped cleanup task.
- `TASK-20260620-002` classified all six remaining `src/routes/*` files as delete-ready after Owner approval and post-deletion validation. No deletion was performed in that classification task.
- `TASK-20260620-003` produced the approval-gated deletion preflight contract and green non-destructive baseline. Future deletion should follow that contract exactly.
- Cross-feature order lifecycle changes use an additive database contract plus thin API/router adapters: ordinary active-order patches remain field-scoped, while terminal correction/reopen/void are dedicated atomic commands. Customer history/finance reads use explicit v3 facts with a compatibility delegator rather than overloading ambiguous v2 names.
- `TASK-20260716-004-device-left-status-plan` proposes nullable two-state current custody plus existing `delivered_at`, with a dedicated versioned mutation and no duplicate `returned/unknown` business enum. This is a proposed contract, not implemented architecture.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Lifecycle command/read-model boundary | Backend + Data + Frontend | Additive v3 facts and dedicated terminal commands; old read overloads delegate during compatibility | Fail closed on invalid contract; forward-fix additive schema and keep immutable evidence | TASK-20260716-003-customer-finance-order-correction-plan | verified |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| ARCH-20260619-001 | Legacy route files remain after active dependency removal | Search/review confusion and accidental reuse risk | Architecture + Frontend + QA | Owner-approved deletion cleanup task | preflight ready; deletion approval pending |
| ARCH-20260619-002 | Large modules exceed comfortable review size | Higher bug/regression risk | Architecture + QA | during 60-day refactor plan | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk architecture baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Refreshed legacy route migration plan from current `src/routes` and `@/routes` source scan | TASK-20260619-022 | Integration Lead | active |
| 2026-06-19 | Added implementation contract for feature-owned order-list migration | TASK-20260619-023 | Integration Lead | active |
| 2026-06-19 | Recorded green pre-implementation baseline for order-list migration | TASK-20260619-024 | Integration Lead | active |
| 2026-06-19 | Recorded active order-list migration out of legacy route and deferred remaining `src/routes/*` cleanup | TASK-20260619-025 | Integration Lead | active |
| 2026-06-20 | Classified remaining `src/routes/*` files as delete-ready after Owner approval | TASK-20260620-002 | Integration Lead | active |
| 2026-06-20 | Added approval-gated deletion preflight contract and baseline for legacy route cleanup | TASK-20260620-003 | Integration Lead | active |
| 2026-07-16 | Recorded additive customer read model and dedicated atomic terminal-command architecture | TASK-20260716-003-customer-finance-order-correction-plan | Integration Lead + architecture/data reviewers | active |
| 2026-07-16 | Recorded proposed order-custody architecture and its non-implementation boundary | TASK-20260716-004-device-left-status-plan | Integration Lead + DATA/API reviewer | proposed |
