# Memory Delta — TASK-20260710-009-security-reliability-hardening-release

## Candidate project facts

- Source: TASK-009 linked read-only verification. Status: verified 2026-07-10. Owner: DATA/SEC. Scope: ChinaTech_date. Fact: 17 legacy public tables have RLS disabled and direct anon/authenticated data privileges; containment requires consumer discovery before policy changes. Review trigger: any database release or legacy app retirement.
- Source: TASK-009 recovery drill. Status: verified. Owner: DATA/OPS. Scope: migration chain. Fact: version-list alignment does not prove from-zero recovery; the historical chain fails at `20260611102805`, while a current linked-schema clone can validate new additive migrations. Review trigger: migration baseline reconstruction or restore drill.

## Candidate department updates

- DATA/SEC: distinguish a migration-slice PASS from environment-level Database Gate PASS.
- QA/OPS: RPC-dependent releases must use DB expand and visibility verification before application deployment.

## Candidate decisions / ADRs

- Candidate ADR: use immutable ledger plus a service-role-only security-invoker RPC for payment commands; stale browser bodies receive a server-generated UUID, new clients supply stable retry keys.
- Candidate decision: technician/viewer customer access remains fail closed until a stable assignment/scope model and minimal DTO exist.

## Candidate lessons and capability evidence

- Target-schema clone plus pgTAP is strong compatibility evidence for one migration but cannot substitute for full backup/PITR restore proof.
- JavaScript money validation must normalize safe integer cents with a tolerance; strict `amount * 100` equality rejects valid values such as 0.29.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
