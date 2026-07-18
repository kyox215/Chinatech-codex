---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T12:25:17Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 03 completed: traceable parts catalog, supplier purchase lots, locked allocation/release, inventory movements and category/supplier Profit Center breakdowns passed exact PostgreSQL, 130 focused tests, lint/type/build and responsive browser verification.

## Blocking decisions

- Production database apply remains NO-GO: historical migration replay still fails before
  TASK-008 at `20260611102805_repairdesk_remote_schema_compatibility.sql` because
  `inventory_items.product_channel` is missing.
- Legacy browser-role table exposure remains open in `OPEN_CONFLICTS.md`.
- PITR or an isolated restore proof is still absent; Stage 07 must obtain recovery evidence,
  a fresh linked pending-set dry-run and the production release lock before any apply.

## Next action

Begin Stage 04A cost export with owner/authorized-manager permission, bounded filters, streaming generation and zero cost leakage when disabled.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
