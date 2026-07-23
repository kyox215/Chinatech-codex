# Memory Delta — TASK-20260723-002-orders-page-performance-audit

## Candidate project facts

- Source: E-004/E-008/E-009. Status: verified. Owner: FE/API. Scope: `/orders` startup. Fact: closed order dialogs previously loaded large detail/new-order modules and the workspace preloaded customers, inventory and two order details; the optimized path loads dialogs on intent and uses the existing queue-summary endpoint.

## Candidate department updates

- FE: preserve direct routes and mobile UI while code-splitting dialog-only screens; retain focus/hover/click detail prefetch.
- API: prefer the existing single-actor `orders/queue-summary` before introducing a new bootstrap contract.
- Data/QA: database-side pagination remains gated by explicit projection, parity tests, tenant-role matrix, 1001+ fixtures and EXPLAIN evidence.

## Candidate decisions / ADRs

- Decision: do not introduce cross-request actor TTL caching without authoritative permission/store invalidation.
- ADR candidate: service-role-only explicit-field order list pagination RPC with legacy-path fallback for unsupported advanced filters.

## Candidate lessons and capability evidence

- Four read-only department agents independently reviewed FE, API architecture, data and QA; main thread remained the sole writer.
- Verification evidence: lint/typecheck, 341 Vitest files and 2272 tests, production build, and controlled Chromium request-count/visual regressions.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
