# Memory Delta — TASK-20260718-008-order-cost-phase2

## Candidate project facts

- **Verified / promoted:** Phase 2 order-cost schema is applied in production; the five child
  capabilities remain default-off. Source: E-061..E-069. Owner: Integration Lead. Scope:
  RepairDesk order costs. Review trigger: any child flag activation, schema change or backfill.
- **Approved / promoted:** Operational repair margin uses quote snapshots and excludes unknown cost
  from exact margin; it is not accounting net profit. Source: `docs/ORDER_INTERNAL_COSTS.md` and
  Stage 02. Owner: Product/Owner. Review trigger: accounting/VAT scope change.

## Candidate department updates

- DATA/BACKEND/SEC: append-only revisions, service-role-only RPCs, zero browser grants and immutable
  currency snapshots are production-verified for the Phase 2 slice.
- FE/PRODUCT: unauthorized users do not mount or request Phase 2 finance surfaces; Phase 1 cost and
  quote entry remains the production default.
- QA/OPERATIONS/DOC: exact migration → non-force main push → exact-SHA deploy → closed-flag smoke →
  no-op/data observation is the verified release sequence; Option B does not certify recovery.

## Candidate decisions / ADRs

- **Approved / task-scoped:** Owner Option B accepts untested physical restore and pre-existing
  full-history replay failure for this release only. It is not a permanent policy or recovery fix.

## Candidate lessons and capability evidence

- Current-schema replay plus exact linked pre/post checks can bound a migration release, but cannot
  replace a physical restore drill.
- Dormant schema releases should prove child flags absent, sensitive UI hidden, error logs clean and
  background-write tables unchanged before closeout.
- Integration Lead and three real Stage 00 review agents produced reproducible scoped evidence;
  record as C2 candidate only. No permission/autonomy upgrade is approved.

## Consolidation result

- Promoted to `PROJECT_MEMORY.md`, `MEMORY_INDEX.md` and the relevant Product, Frontend, Backend,
  Data, Security, QA, Operations and Documentation department memories.
- No customer PII, credentials, environment-variable values or raw production rows were promoted.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
