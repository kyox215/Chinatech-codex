---
schema_version: 1
current_task_id: "TASK-20260720-001-ai-order-query-v4-release"
status: "active"
phase: "integration"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T23:40:42Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**AI 自然语言订单查询 V4 第一发布包**

## Current state

V4 implementation, security hardening, 417-case evaluation, 136 focused tests, 12 browser tests, full Vitest 2,088/2,088, lint, typecheck, production build, docs and screenshots are complete in the isolated worktree. No production release has occurred. `origin/main` advanced by one disjoint order-detail commit.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Acquire the integration lease, commit and rebase onto current `origin/main`, repeat release gates, then push/deploy the exact SHA and complete production smoke plus observation.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-001-ai-order-query-v4-release/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
