---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T12:46:39Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 04A completed: permission-gated PII-minimized formula-safe cost/margin CSV export passed Stage 01-04A disposable PostgreSQL replay, 57 focused tests, targeted store capability test, lint, typecheck, production build and authorized/feature-off browser verification.

## Blocking decisions

- Local Stage 04B work may continue, but production database/release remains NO-GO until the
  known historical replay failure at `20260611102805_repairdesk_remote_schema_compatibility.sql`
  (`inventory_items.product_channel` missing) is resolved or formally accepted.
- Production release also requires closure or explicit acceptance of the legacy browser-role
  exposure conflict and current PITR/isolated-restore proof. Re-read `OPEN_CONFLICTS.md` and run
  the Stage 07 fresh linked dry-run and recovery gate; do not infer clearance from local harnesses.

## Next action

Read 04B_HISTORY_BACKFILL.md; implement preview-first bounded historical cost candidate runs, owner-only apply/revert, idempotency and no automatic production backfill; stop if evidence provenance or rollback cannot be proven.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
