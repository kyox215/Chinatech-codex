---
schema_version: 1
current_task_id: "TASK-20260720-003-smart-print-qr"
status: "active"
phase: "implementing_gated_discovery"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T19:07:00Z"
checkpoint_required: true
last_rehydrated_at: null
---

# Active Context

## Current objective

在客户维修单恢复单一双用途智能 QR：客户查看精简维修进度，已授权员工进入内部任务页；完成数据库、代码、测试后推送并应用生产。

## Current state

本任务从远端 `main` 的 `19f420717709991ed9f055124bdb9eb08934bcdd` 建立独立工作树。产品规划已由 Owner 批准；三名只读部门 Agent 已完成或正在完成 DATA/架构、SEC/隐私和 QA/UX 复核。生产已应用但 main 缺失的 AI 账本热修复 `20260720065246` 正作为强制前置整合；尚未应用智能 QR migration 或发布本任务功能。

## Blocking decisions

- Owner 已明确批准推送和应用；无需再次请求普通发布授权。
- 生产 Supabase 的 migration history 与 `db push --dry-run` 是硬门禁；智能 QR migration 创建和应用前必须把已验证的 `20260720065246` 完整分支整合并重新证明 parity。
- 公开客户投影、同店员工授权、QR 打印准备和完整质量门禁必须通过后才能发布。

## Next action

完成前置热修复分支 merge，确认 linked migration list/dry-run up to date，实施 hash-only token 表、公开/员工 API、`/r` 页面与异步打印 QR，再运行完整验证和序列化生产发布。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-003-smart-print-qr/TASK.md`, `PLAN.md`, `CHECKPOINTS.md`, `EVIDENCE.md`, and `HANDOFF.md`.
3. Inspect current Git/workspace state before changing files.
4. Do not publish from the original dirty checkout. Serialize Supabase/Git/Vercel writes and stop on migration drift, public-data leakage, auth regression, missing QR, non-fast-forward or HTTP 500.
