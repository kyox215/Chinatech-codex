---
schema_version: 1
current_task_id: "TASK-20260720-003-smart-print-qr"
status: "active"
phase: "release_ready_pre_apply"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T20:48:18Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

在客户维修单恢复单一双用途智能 QR：客户查看精简维修进度，已授权员工进入内部任务页；完成数据库、代码、测试后推送并应用生产。

## Current state

智能 QR 发布候选已完成。首个生产 migration apply 因 link `order_id text` 与生产订单 UUID 不匹配，被 PostgreSQL 在首条建表语句安全拒绝；migration 未登记、功能开关仍关闭、应用未推送，无客户影响。迁移现已改为 UUID 并在全新 PostgreSQL 17 UUID fixture 中重放通过，包括并发签发、单 active、audit rollback、revoke、RLS/grants 与组合限流。尚未重试生产 migration、启用开关、推送或完成 Vercel smoke。

## Blocking decisions

- Owner 已明确批准推送和应用；无需再次请求普通发布授权。
- 应用生产前再次 fetch main，并重复 migration list/dry-run；只允许 `20260720190759`。
- 数据库、Git、Vercel 必须串行；任何非快进、额外 migration、部署 ERROR 或生产 HTTP 500 都停止并进入恢复。

## Next action

完成 UUID 修正后的代码门禁与 linked dry-run，amend 尚未推送的提交；仅在 dry-run 仍只含 `20260720190759` 时重试并验证数据库，然后非强推 `main`、启用开关、等待精确 SHA 的 Vercel production READY 后执行 smoke。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-003-smart-print-qr/TASK.md`, `PLAN.md`, `CHECKPOINTS.md`, `EVIDENCE.md`, and `HANDOFF.md`.
3. Inspect current Git/workspace state before changing files.
4. Do not publish from the original dirty checkout. Serialize Supabase/Git/Vercel writes and stop on migration drift, public-data leakage, auth regression, missing QR, non-fast-forward or HTTP 500.
