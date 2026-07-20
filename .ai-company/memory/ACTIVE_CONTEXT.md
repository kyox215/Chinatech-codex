---
schema_version: 1
current_task_id: "TASK-20260720-003-smart-print-qr"
status: "active"
phase: "implementing_gated_discovery"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T18:59:37Z"
checkpoint_required: true
last_rehydrated_at: null
---

# Active Context

## Current objective

在客户维修单恢复单一双用途智能 QR：客户查看精简维修进度，已授权员工进入内部任务页；完成数据库、代码、测试后推送并应用生产。

## Current state

本任务从远端 `main` 的 `19f420717709991ed9f055124bdb9eb08934bcdd` 建立独立工作树。产品规划已由 Owner 批准；三名只读部门 Agent 正在复核 DATA/架构、SEC/隐私和 QA/UX。尚未应用生产迁移或发布本任务代码。

## Blocking decisions

- Owner 已明确批准推送和应用；无需再次请求普通发布授权。
- 生产 Supabase 的 migration history 与 `db push --dry-run` 是硬门禁；任何历史漂移或未审 migration 都会停止数据库 apply。
- 公开客户投影、同店员工授权、QR 打印准备和完整质量门禁必须通过后才能发布。

## Next action

完成 linked migration gate，整合三路只读审查，实施 hash-only token 表、公开/员工 API、`/r` 页面与异步打印 QR，再运行完整验证和序列化生产发布。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-003-smart-print-qr/TASK.md`, `PLAN.md`, `CHECKPOINTS.md`, `EVIDENCE.md`, and `HANDOFF.md`.
3. Inspect current Git/workspace state before changing files.
4. Do not publish from the original dirty checkout. Serialize Supabase/Git/Vercel writes and stop on migration drift, public-data leakage, auth regression, missing QR, non-fast-forward or HTTP 500.
