---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T11:34:32Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 02 completed: bounded store-timezone repair profit RPC, permission-hidden /finance UI, expected and delivered quote margins, daily/monthly trends, data-quality coverage and PII-free drilldown passed exact PostgreSQL assertions, 56 focused tests, type/lint/build and six responsive browser widths.

## Blocking decisions

- Local implementation may continue, but broad production database application remains NO-GO
  under `.ai-company/memory/OPEN_CONFLICTS.md`: the legacy migration chain still cannot replay
  from zero, legacy browser-role exposure remains open, and isolated backup/PITR restore proof is
  absent.
- Stage 07 must re-fetch `origin/main`, acquire the serialized release lock, prove the exact linked
  pending set and dry-run, and obtain the required recovery/restore evidence before any migration
  apply or production deployment. Do not bypass this gate based on local harness success.

## Next action

Begin Stage 03 parts procurement and supplier linking; integrate catalog and supplier dimensions into the Profit Center and rerun Stage 02 profit regression before Stage 03 close.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
