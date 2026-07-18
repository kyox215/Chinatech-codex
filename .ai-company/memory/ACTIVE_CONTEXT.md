---
schema_version: 1
current_task_id: "TASK-20260718-008-order-cost-phase2"
status: "active"
phase: "production_release_preflight"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T15:28:23Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单成本第二期分阶段实施与发布**

## Current state

Owner 已选择 Stage 08 Option B，接受本次发布的未验证物理恢复与全历史 replay 风险；共享原子 release lock 已取得，主检出目录不修改，所有第二期子开关保持关闭，尚未执行生产写入。

## Blocking decisions

- PITR and isolated physical restore remain unproven; Owner accepted that risk for this release
  only under Stage 08 Option B.
- Full historical migration replay remains broken before TASK-008; Option B accepts but does not
  resolve that recovery-baseline debt.
- Any remote drift, extra migration, failed backup visibility, failed post-apply assertion, Git
  non-fast-forward, deployment SHA mismatch or production regression remains a hard stop.

## Next action

在隔离工作树内 fresh fetch，核对 origin/main、linked migration list、精确 dry-run、backup 与 advisors；任何额外迁移或远端漂移立即停止。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-008-order-cost-phase2/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
