# Memory Delta — TASK-20260717-004-order-diagnosis-quote-implementation

## Candidate project facts

- **Fact:** linked production currently uses UUID IDs for `repair_orders`, `order_events`, `message_logs` and `order_payment_ledger`, while `audit_logs.id` / entity IDs remain text. **Source:** read-only information schema precheck on 2026-07-17. **Status:** verified. **Owner:** DATA. **Scope:** quote/message RPCs and future migrations. **Review trigger:** any schema reconciliation migration.
- **Fact:** linked production lacked the application-contract column `message_logs.channel` before this release. **Source:** read-only information schema precheck. **Status:** verified; additive compatibility column included in `20260717213518`. **Owner:** DATA/API. **Scope:** order notification history. **Review trigger:** after migration postcheck or future message-provider work.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- Quote version identity is the opaque `quoted` event UUID, not a mutable integer revision.
- Formal publication and staff-confirmed sending are separate service-role-only atomic RPCs; opening `wa.me` is always client-only and never writes `sent`.
- First-quote preparation uses non-grantable `order:quote_prepare`; technicians diagnose and hand off, while owner/manager/sales publish and confirm send.

## Candidate lessons and capability evidence

- Responsive browser measurement caught a mobile dialog intrinsic-width overflow that static tests did not; `min-w-0` is required on this wide grid dialog.
- Migration timestamps must be reissued after absorbing a later concurrently applied remote migration; never use `--include-all` to bypass ordering drift.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
