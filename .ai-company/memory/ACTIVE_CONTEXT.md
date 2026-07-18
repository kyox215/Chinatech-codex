---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "release_readiness"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T14:38:02Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 06 completed locally: candidate rebased to origin/main@51d5b3b9; out-of-order Phase 2 migrations reissued after Phase 1; fresh PostgreSQL 17 ledger/full chains, 1669 tests, lint, typecheck, agent rules, ACL/RLS review and webpack build passed; production Database Application Gate remains NO-GO.

## Blocking decisions

- Broad production database release remains NO-GO: the historical replay still fails at
  `20260611102805_repairdesk_remote_schema_compatibility.sql` because
  `inventory_items.product_channel` is missing.
- Legacy browser-role table exposure remains open under `CONFLICT-20260619-006`.
- PITR/recovery baseline and an isolated restore proof remain absent.
- Stage 07 must re-fetch and serialize the release, prove the exact linked pending set/dry-run and
  recovery evidence, and stop without applying, pushing or deploying if any gate remains open.

## Next action

Commit Stage 06, then run Stage 07 read-only linked/remote preflight under serialized release control. Stop before DB/Git/deploy writes unless historical replay, legacy browser-role exposure and PITR/isolated restore proof gates are all GO.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
