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
- `TASK-20260716-005-device-custody-status-implementation` implements nullable two-state current custody plus existing `delivered_at`, with dedicated versioned active/terminal mutations and no duplicate `returned/unknown` business enum. Migration `20260716235650`, PG17 replay and production postchecks make this the scoped-verified architecture; legacy NULL remains a fact, not an enum value.
- `TASK-20260718-009-ai-assistant-implementation` verifies the dormant AI boundary: existing Next.js BFF, strict provider interface, server-derived actor/store/RBAC, allowlisted read tools, server-built cards and hierarchical fail-closed flags. Image recognition only produces a reviewed page-memory inventory form draft; any live provider, write tool or persistence requires a new architecture/security decision.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |
| Lifecycle command/read-model boundary | Backend + Data + Frontend | Additive v3 facts and dedicated terminal commands; old read overloads delegate during compatibility | Fail closed on invalid contract; forward-fix additive schema and keep immutable evidence | TASK-20260716-003-customer-finance-order-correction-plan | verified |
| Proposed online order-create command | Backend + Data + Frontend + QA | One store-scoped idempotency key and request hash; atomically return the original order for same-key/same-payload replay | Reject key/payload conflicts; expose result lookup for browser timeout recovery; no production change until approved | TASK-20260717-163954-task | proposed |
| First-phase online order-create recovery | Backend + Data + Frontend + QA | Client `operation_id`, server created-event replay lookup, status endpoint and no duplicate audit/realtime on replay | UI blocks repeat submit while confirming; full atomicity remains out of scope | TASK-20260717-165957-task | verified_local |
| Dormant bounded AI assistant | Backend + Frontend + Security + QA | Server-owned actor/store/RBAC, two read-only order tools, strict vision contract and reviewed page-memory inventory draft | Parent/child flags, empty store allowlist, zero quota and fake provider fail closed; no formal save until existing service path | TASK-20260718-009-ai-assistant-implementation E-009–E-039 | production_verified_dormant |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| ARCH-20260619-001 | Legacy route files remain after active dependency removal | Search/review confusion and accidental reuse risk | Architecture + Frontend + QA | Owner-approved deletion cleanup task | preflight ready; deletion approval pending |
| ARCH-20260619-002 | Large modules exceed comfortable review size | Higher bug/regression risk | Architecture + QA | during 60-day refactor plan | open |
| ARCH-20260717-001 | Online order create crosses customer/device/order/event/audit boundaries without one transaction; first-phase event replay reduces ambiguous-success UX but is not the final command boundary | Partial writes and pre-event duplicate races remain possible | Architecture + Backend + Data + Security | Owner review in a separate T3/R3 atomic RPC task; ADR required before migration | mitigated_first_phase; decision_proposed |
| ARCH-20260718-001 | Live OpenAI activation lacks approved provider dependency, durable quota/deadline/safety identifier and server-side image sanitation | External-call cost, reliability and data-processing risk | Architecture + Security + Operations + Owner | new R4 task before any live provider or real image request | blocked_by_approval |

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
| 2026-07-17 | Promoted the proposed order-custody architecture to production-verified implementation with atomic active/terminal commands | TASK-20260716-005-device-custody-status-implementation | Integration Lead + DATA/API/SEC reviewers | scoped_verified |
| 2026-07-17 | Added proposed atomic, idempotent online order-create command boundary and ADR trigger | TASK-20260717-163954-task | Integration Lead + API/Data reviewer | proposed |
| 2026-07-17 | Added verified first-phase no-DDL online create recovery boundary and retained atomic RPC as future architecture decision | TASK-20260717-165957-task | Integration Lead | verified_local |
| 2026-07-18 | Added production-verified dormant bounded-AI BFF and page-memory vision-draft boundary; retained live provider/persistence as separate approval gates | TASK-20260718-009-ai-assistant-implementation | Integration Lead + Architecture/Security reviewer | scoped_verified_dormant |
