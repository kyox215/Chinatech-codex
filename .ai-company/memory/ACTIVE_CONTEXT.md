---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T13:32:02Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 04B completed: preview-only historical cost candidates, Owner-only bounded apply, conflict-safe resume, compensating revert, fresh Stage 01-04B PostgreSQL replay, 94 focused tests, lint/type/build and browser confirmation passed.

## Blocking decisions

- Local Stage 05–06 work may continue, but production database/release remains NO-GO until the
  known historical replay failure at `20260611102805_repairdesk_remote_schema_compatibility.sql`
  (`inventory_items.product_channel` missing) is resolved or formally accepted.
- Production release also requires closure or explicit acceptance of the legacy browser-role
  exposure conflict and current PITR/isolated-restore proof. Re-read `OPEN_CONFLICTS.md` and run
  the Stage 07 fresh linked dry-run and recovery gate; do not infer clearance from local harnesses.

## Next action

Commit Stage 04B independently, then read and implement 05_MULTI_CURRENCY_COSTS.md with immutable original-currency and EUR FX snapshots; do not use network FX or change customer quote currency.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
