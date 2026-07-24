---
schema_version: 1
current_task_id: "TASK-20260724-005-a5-order-print"
status: "active"
phase: "release"
task_class: "T3"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-24T11:25:00Z"
checkpoint_required: true
last_rehydrated_at: null
---
# Active Context

## Current objective

**A5 工单打印与 A4 对半裁切**

## Current state

隔离发布候选已完成代码、文档、定向测试、lint、typecheck、production build，并生成 A5/A4 PDF 证据；等待精确提交、推送 main、生产部署和线上冒烟。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

提交发布候选，快进推送 main，部署 Vercel Production，验证生产订单页与打印入口。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260724-005-a5-order-print/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
