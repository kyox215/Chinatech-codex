---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "production_git_push"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T15:38:13Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

六个第二期生产迁移已精确应用；linked history 与 no-op dry-run、11 表 RLS/ACL、21 RPC、search_path、security-invoker 视图、约束、索引、迁移快照和零自动回填后检全部通过；advisors 无新增 Phase 2 告警。Git push/deploy 尚未执行。

## Blocking decisions

- Database release slice passed; do not reapply migrations.
- Option B recovery risks remain accepted but unresolved.
- Stop on remote main drift, non-fast-forward push, deployment SHA mismatch or production
  regression; all Phase 2 child flags remain off.

## Next action

提交数据库应用证据；fresh fetch 并断言 origin/main 未漂移、候选零 behind、工作树干净，然后非强制 push HEAD:main，立即核验远端 SHA。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
