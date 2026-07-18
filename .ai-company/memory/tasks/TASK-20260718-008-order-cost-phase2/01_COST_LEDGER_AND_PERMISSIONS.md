# Stage 01 — Cost Ledger and Permissions

Status: completed

## Goal

Extend the Phase 1 cost snapshot into a source-aware, revision-safe ledger without exposing costs to ordinary order paths.

## Scope

- Cost state: `unknown`, `estimated`, `confirmed`, `reconciled`.
- Cost source: manual, default, purchase lot, supplier receipt and backfill estimate.
- Original amount/currency, EUR base amount, exchange-rate snapshot and source references.
- Append-only revision/audit evidence for corrections.
- New permissions for read, manage, export, backfill, allocation and currency management.
- Owner inherent authority; Manager explicitly grantable; Technician/Sales/Viewer permanently denied.

## Validation

- Migration structure and static migration tests.
- Null versus explicit zero; estimated versus confirmed.
- CAS conflict, duplicate request, stale line set and cross-order/cross-store rejection.
- Ordinary order/list/print/message/realtime/offline DTO leak tests.
- Permission matrix, forged grants and direct API denial tests.
- Targeted lint, typecheck and unit/integration tests.

## Exit criteria

- Additive schema and compatible server contracts are green.
- Phase 1 UI continues to work with EUR/manual/default costs.
- Stage checkpoint and evidence entries are written.

## Rollback

Keep new columns/tables dormant, disable Phase 2 flags, and retain audit history; no emergency destructive rollback.

## Completed implementation

- Additive migration `20260718103018_order_cost_phase2_ledger_permissions.sql` keeps the
  Phase 1 EUR projection and adds evidence status, original-currency snapshots, source
  references, append-only line revisions and effective-dated default-cost history.
- Existing Phase 1 write RPCs remain compatible through projection triggers; a real harness
  caught and fixed stale original-EUR snapshots when a default cost is manually changed.
- Added a cost-history repository/API route without adding any cost field to ordinary order,
  print, customer message, Realtime or offline contracts.
- Added manager-grantable export, preview and allocation permissions with dependency
  normalization; bulk backfill apply and currency management remain Owner-only.
- Added independent fail-closed Phase 2 feature flags, all children of the Phase 1 flag.

## Validation result

- 7 focused Vitest files / 56 tests passed.
- Targeted store permission feature tests: 4 passed.
- TypeScript typecheck passed; changed-file ESLint passed; `git diff --check` passed.
- A disposable Supabase Postgres 17.6 container applied the minimal Phase 1 fixture, the exact
  Stage 01 migration and behavior assertions successfully:
  `order_cost_phase2_minimal_harness_passed`.
- The repository-wide clean replay was attempted and stopped before TASK-008 at the existing
  `20260611102805_repairdesk_remote_schema_compatibility.sql` blocker because
  `inventory_items.product_channel` is absent. Temporary ports/config were restored and the
  disposable container was removed.
- Full `supabase test db` remains part of Stage 06/07 and cannot be claimed green until the
  migration recovery baseline gate is resolved.
