# Memory Delta — TASK-20260723-003-startup-performance-print-audit

## Candidate project facts

- Source: E-003/E-004. Status: verified. Owner: FE/API. Scope: business workspace startup. Review trigger: shell or preload architecture changes. Fact: hard refresh uses a client-only sequence of onboarding, store context and page data; unrelated preloads can compete with the active page.
- Source: E-005. Status: verified. Owner: API/DATA. Scope: dashboard. Review trigger: dashboard query rewrite. Fact: dashboard priority currently loads all active wide order rows and ranks them in application memory before returning a small sample.
- Source: E-007. Status: verified defect. Owner: FE/Security. Scope: order printing. Review trigger: permission model update. Fact: list single print is tied to `order:export`, while detail single print follows order-detail scope.

## Candidate department updates

- FE: prioritize store-gated dashboard query, page-owned preload budgets, correct queue-summary preload key and lazy customer detail.
- API/DATA: plan actor/bootstrap aggregation and service-role-only database queries with tenant/role parity tests.
- UX: expose print availability reasons and recovery actions instead of unexplained disabled controls.

## Candidate decisions / ADRs

- Candidate: separate `order:print_single`, `order:print_batch` and `order:export`; do not reuse data-export authority for customer-document printing.
- Candidate: primary page data must settle before cross-domain preloading; preloading is a navigation optimization, not a cold-start dependency.

## Candidate lessons and capability evidence

- Same-session browser timing is required to distinguish application data latency from Next.js development compilation.
- A disabled print button must report the actual state (`loading`, `missing identity`, `voided`, `offline`, `QR disabled`, `permission denied`, `preparing`) and provide recovery when possible.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
