---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "conditional"
phase: "release_blocked"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T15:09:14Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Stage 07 当前生产架构兼容性门禁已通过：无数据 schema dump 恢复到新 PostgreSQL 17，六个第二期迁移按序成功，11 表 RLS、浏览器 ACL/RPC、search_path、视图与约束断言全部通过；未执行任何生产写入。物理备份隔离恢复、PITR 与全历史 replay 风险仍需 Owner 在 Stage 08 选择完整恢复演练或书面有界例外。

## Blocking decisions

- PITR is disabled and the visible completed physical backup has no isolated production-data
  restore proof, restore owner, RPO/RTO or sign-off.
- The current production schema accepts the exact six Phase 2 migrations, but the repository-wide
  clean historical replay still fails before TASK-008. Project policy requires remediation or a
  written Owner exception before linked production mutation.
- Stage 08 requires an explicit Owner choice: A) isolated full restore drill, B) bounded written
  risk exception for this release, or C) keep production unchanged. The default is C.
- No linked migration, production data write, `main` push, deploy, feature-flag change or
  historical backfill has occurred; all Phase 2 child flags remain off.

## Next action

读取 08_PRODUCTION_GATE_REMEDIATION_AND_APPROVAL.md，记录 Owner 明确选择 A/B/C；若批准 A 或 B，先从 fresh fetch、linked migration list、精确 dry-run、backup 与 advisors 重新开始，任何漂移立即停止。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
