# Memory Change Set — TASK-20260720-001

## Promoted as verified

- Customer list navigation uses four stable novice-facing groups: `全部 / 处理中 / 待收款 / 要跟进`; lower-frequency conditions belong in one “更多筛选” surface.
- Customer detail uses five stable groups: `总览 / 工单 / 设备 / 跟进 / 资料`; below `lg`, the fixed header and three bottom actions must account for the desktop sidebar inset at tablet widths.
- Search, group, filters and page are URL state. Page clamping must wait for real non-placeholder query data so a cold `?page=N` load is not rewritten prematurely.
- Opening WhatsApp/SMS is not proof of delivery. Contact history is written only after the employee explicitly confirms the message was sent, and popup blocking must show a plain-language recovery message.
- Customer-list browser responses omit list-unneeded contact, consent, note, blacklist and device-search fields after server filtering and finance projection.
- App-only customer releases remain valid while the linked database gate is NO-GO only when the application has no schema/RPC dependency and no database write is attempted.

Sources: `TASK.md`, `EVIDENCE.md`, `CHECKPOINTS.md`, `docs/RESPONSIVE_DENSITY_PLAN.md`, focused tests, 8/8 responsive E2E and authenticated production smoke.

## Proposed, not promoted as a standard

- Replace the current known-sensitive-field blacklist with a typed browser DTO allowlist before the next customer-list field expansion.
- Align the “要跟进” result boundary and chip count in one server contract after migration provenance is restored.
- These remain technical-debt proposals, not approved schema or API changes.

## Not promoted

- Exact commit hashes, deployment IDs and screenshot paths are run-specific evidence and remain in `EVIDENCE.md`.
- A single successful release does not increase production, database, permission or autonomy authority.

## Conflicts / supersession

- The former six-area customer-detail description is superseded by the five stable groups recorded in `docs/ARCHITECTURE.md`.
- No other long-term memory conflict was found.
