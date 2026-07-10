# Memory Delta — TASK-20260710-110532-task

## Plan-stage candidate decisions

- RepairDesk bulk order data controls should live only in Settings, not on the order list.
- The only allowed actor should be the current store's primary owner: valid owner membership plus `stores.owner_user_id === actor.id`.
- Formal owner transfer should move data authority to the new `owner_user_id`; historical creators should not retain access.
- A separate blank template and a real order-detail export are different artifacts and must remain different buttons/files.
- Import must never clear existing data. Missing rows and blank cells preserve current values; explicit `__CLEAR__` is limited to allowlisted optional fields.
- Recommended format is server-generated XLSX with CSV/SeaTable compatibility, subject to a separate dependency review.

## Plan-stage candidate learnings

- Current client-side order-list export is a second data path that bypasses the intended server authorization/audit model and must be removed when the Settings data center is implemented.
- Current role-based `order:export` / `customer:export` is insufficient for the new rule because manager is allowed and owner role alone does not prove primary ownership.
- `stores.owner_user_id` is the existing canonical identity field for the primary-owner gate.
- The existing SeaTable parser can inform compatibility mapping, but its clear-domain CLI apply path is prohibited for daily UI/API use.
- Import idempotency needs store-scoped external references; customer/device shared-entity conflicts must be visible before apply.

## Implemented candidate decisions

- RepairDesk bulk order data controls now live only in Settings, not on the order list.
- The allowed actor is the current store's primary owner: valid owner membership plus `stores.owner_user_id === actor.id`.
- Template, export, customer-statistics export, import preview and import apply are all server-gated by the same primary-owner/store assertion.
- Import still never clears existing data by omission; blank cells preserve current values and `__CLEAR__` is limited to allowlisted optional fields.
- Backup customer phone numbers are preserved on phone updates by merging imported phones with existing `contact_phones`; unchanged primary-phone roundtrips do not stage backup-phone replacement.
- Repair item rows with multiple identifiers must match a single order row; conflicting identifiers are rejected instead of being attached by first match.
- Preview now displays clean ready/skip/error rows, not only warning/error rows.
- The first release does not install or schedule `pg_cron`; it exposes a cleanup RPC and calls it before creating import previews. A scheduled cleanup job should be a separate release if needed.

## Long-term promotion status

Promote only after the scoped commit is pushed to `main`, the linked migration is applied, and post-apply checks pass.
