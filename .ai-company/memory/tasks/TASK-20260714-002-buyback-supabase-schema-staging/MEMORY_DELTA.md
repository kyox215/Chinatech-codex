# Memory Delta — TASK-20260714-002-buyback-supabase-schema-staging

## Consolidated verified rules

- Production migration `20260712150000` is applied as dormant schema staging, not as sensitive-feature activation.
- `buyback_agreements` and `repairdesk_finalize_buyback` must remain inaccessible to every runtime role until a separately approved enable migration.
- A production migration with an older timestamp must be frozen in Git, reconciled against remote history, and selected by an exact CLI dry-run before apply; do not substitute name-only migration tools or history repair.
- Payment/data anomaly guards belong before the first DDL/DML, with bounded lock and statement timeouts.
- A dormant evidence bucket may exist only as private and empty while upload policies and application routes remain disabled.
- Restore-point visibility is not a restore drill: the project has completed physical backups, but PITR is off and full-history reset is still blocked by earlier migration debt.

## Memory change set

- Updated project authority from “production schema absent” to “dormant schema applied, runtime still feature-off”.
- Synchronized Data, Security, QA, Operations and Documentation boundaries and indexed the closed task.
- Preserved exact SHA, timestamps, commands and catalog counts in task evidence rather than promoting run-specific details into broad project rules.
- No public API or UI documentation changed because the runtime workflow and user-visible feature-off behavior did not change.

## Residual risks

- Full migration history cannot yet be rebuilt from zero because pre-existing migration `20260611102805` assumes a missing `inventory_items.product_channel` column.
- PITR is disabled; physical backup visibility exists, but no isolated restore drill was completed in this task.
- Retention, staged-file cleanup, legal hold, immutable agreement access, legal text, advanced file validation, tenant-composite FKs and real concurrency remain hard enable gates.
- Existing project-wide Supabase advisor findings outside this target slice were not remediated by this bounded migration.
