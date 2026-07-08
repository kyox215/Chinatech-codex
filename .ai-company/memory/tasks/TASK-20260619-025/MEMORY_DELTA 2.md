# Memory Delta — TASK-20260619-025

## Candidate project facts

- `TASK-20260619-025` moved the active order-list implementation out of the legacy `@/routes/orders.index` wrapper. Source scan now has no active `@/routes` imports under `src`.
- Remaining `src/routes/*` files are cleanup candidates only; they were not deleted in this task.
- Order-list migration validation passed: lint, typecheck, full tests, and non-sandbox production build. Sandbox build failed with the known Turbopack port-binding environment issue.

## Candidate department updates

- ARCH: update legacy route debt from "active dependency open" to "active dependency removed; cleanup pending."
- QA: record L2-021 gates and sandbox-build classification.
- DOC/MEM: register `ORDER_LIST_MIGRATION_IMPLEMENTATION_REPORT.md` and task evidence as authoritative for this migration.

## Candidate decisions / ADRs

- Decision: keep legacy `src/routes/*` files untouched until a separate cleanup task classifies/deletes them.

## Candidate lessons and capability evidence

- L2 business-code migration can proceed safely when there is a green pre-implementation baseline, tight file ownership, no production/data/dependency actions, and full post-change gates.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
