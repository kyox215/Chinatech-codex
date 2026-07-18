---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "production_database_apply"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T15:33:09Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Option B fresh 生产写入前门禁通过：origin/main 未漂移；linked history 与 dry-run 仅含六个审核迁移；八个物理备份完成；advisors 只有既有告警；PG17.6 count-only SQL 与浏览器 ACL 基线匹配。尚未生产写入。

## Blocking decisions

- Option B accepts the missing physical-restore and full-history replay proof for this release
  only; it does not resolve those standing recovery risks.
- Exact six-file dry-run, backup visibility and current-schema/ACL preflight are green.
- Stop on any extra migration, remote drift, failed apply/postcheck, Git non-fast-forward,
  deployment SHA mismatch or production regression.

## Next action

提交 fresh preflight 证据；立即再次执行 exact dry-run，若仍为六文件则运行 supabase db push --linked，并在返回后先重读 migration history 与 Phase 2 元数据/ACL，再允许 Git 推送。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
