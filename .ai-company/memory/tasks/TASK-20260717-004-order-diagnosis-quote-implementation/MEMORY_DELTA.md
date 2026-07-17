# Memory Delta — TASK-20260717-004-order-diagnosis-quote-implementation

## Candidate project facts

- **Fact:** linked production currently uses UUID IDs for `repair_orders`, `order_events`, `message_logs` and `order_payment_ledger`, while `audit_logs.id` / entity IDs remain text. **Source:** read-only information schema precheck on 2026-07-17. **Status:** verified. **Owner:** DATA. **Scope:** quote/message RPCs and future migrations. **Review trigger:** any schema reconciliation migration.
- **Fact:** linked production lacked the application-contract column `message_logs.channel` before this release. **Source:** read-only information schema precheck. **Status:** verified; additive compatibility column included in `20260717213518`. **Owner:** DATA/API. **Scope:** order notification history. **Review trigger:** after migration postcheck or future message-provider work.

## Department updates

- **Product/Frontend:** unknown intake is not a zero-price quote; customer report, diagnosis and charge lines remain distinct. `wa.me` open is not evidence of send. **Status:** production verified. **Source:** UI/API/tests and deployment evidence. **Review trigger:** intake, quote or customer-message redesign.
- **Backend/Data/Security:** quote publication and confirmed-send are separate service-role-only invoker RPCs with store/actor validation, CAS, idempotency, derived money and minimal audit evidence. **Status:** production verified. **Source:** migration `20260717213518` and postcheck. **Review trigger:** quote schema, role or notification-provider change.
- **QA/Operations:** serialized DB-first release, remote assertions, latest-main rebase, exact-SHA deployment and runtime smoke passed. **Status:** scoped verified. **Source:** `EVIDENCE.md`. **Review trigger:** next cross-domain order release.

## Candidate decisions / ADRs

- Quote version identity is the opaque `quoted` event UUID, not a mutable integer revision. **Status:** production verified. **Owner:** Product/API. **Scope:** quote preview and notification. **Source:** migration/API tests and postcheck. **Review trigger:** quote version redesign.
- Formal publication and staff-confirmed sending are separate service-role-only atomic RPCs; opening `wa.me` is always client-only and never writes `sent`. **Status:** production verified. **Owner:** API/Data/Security. **Scope:** formal quote notification. **Source:** `20260717213518` and production smoke. **Review trigger:** automatic provider integration.
- First-quote preparation uses non-grantable `order:quote_prepare`; technicians diagnose and hand off, while Owner/Manager/Sales publish and confirm send. **Status:** approved and production verified. **Owner:** Product/Security. **Scope:** staff quote actions. **Source:** capability/server tests and independent review. **Review trigger:** role-policy change.

## Candidate lessons and capability evidence

- Responsive browser measurement caught a mobile dialog intrinsic-width overflow that static tests did not; `min-w-0` is required on this wide grid dialog. **Status:** observed once. **Owner:** Frontend/QA. **Scope:** this quote dialog. **Source:** 390px browser measurement. **Review trigger:** similar responsive overflow.
- Migration timestamps must be reissued after absorbing a later concurrently applied remote migration; never use `--include-all` to bypass ordering drift. **Status:** scoped verified. **Owner:** Data/Operations. **Scope:** serialized releases. **Source:** linked list/dry-run history. **Review trigger:** migration interleave.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.

## Memory Change Set

- Promoted the verified product, frontend, backend, data, security, QA and operations contracts into the corresponding department memories and task index.
- Added a C1 candidate capability record only; no permission or autonomy change was approved.
- Kept the responsive `min-w-0` observation and migration-timestamp renumbering as task-scoped candidates because one task is insufficient to make either a universal standard.
- No conflict was opened: the historical reset failure already exists as `DATA-20260710-002` and remains unresolved rather than being overwritten.
