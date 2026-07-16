# Memory Delta — TASK-20260716-003

## Verified facts

- Historical order count/time and valid repair/finance facts are separate contracts. Cancelled/custom-cancelled/voided/deleted rows stay in history but contribute zero to valid count, active work, lifetime quote and receivables.
- Repair and payment states are orthogonal in customer UI; finance-restricted responses must not leak or fabricate zero amounts.
- Completed/custom-done positive balances remain collectible; cancelled/custom-cancelled/voided/deleted rows fail closed while successful prior payment requests remain idempotently replayable.
- Terminal correction, reopen, void and cancelled-custody confirmation require dedicated atomic RPCs and immutable evidence; generic updates and data-batch application are guarded.
- CRM order references require same-store composite FKs with `ON DELETE SET NULL (order_id)`.

## Implemented decisions

- Additive customer v3 facts with historical `order_count/last_order_at` plus explicit valid/finance names; both v2 overloads delegate to final v3.
- Server-projected fine-grained capabilities and changed-fields-only payload.
- Dedicated audited terminal correction/reopen and Owner-only soft void.
- No normal hard purge.

Implementation, independent review, fresh PG17 migration replay, 102 pgTAP assertions, 1021 unit/integration tests, build and responsive browser evidence support these facts. Production versions `20260716221119`, `20260716221139`, `20260716221159` and `20260716221448` are applied and postchecked on `ChinaTech_date`; application push/deployment proof remains pending.

## Long-term promotion

- Promote the finance/history split, orthogonal repair/payment states and audited terminal-action boundary as verified product/frontend/backend/data/security contracts.
- Record the fresh-current-schema clone plus exact pending migration replay as an `observed/proposed exception` when CLI authentication is unavailable. It still requires Owner/release approval and exact remote postchecks; it does not replace CLI dry-run, historical reset or PITR certification.
- Keep capability evidence at candidate/restricted level: this is one successful serialized high-risk release and does not upgrade permission or autonomy.
- Do not promote temporary container names, raw advisor inventories, production row samples or screenshot mock values.
