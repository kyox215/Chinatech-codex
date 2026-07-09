---
schema_version: 1
current_task_id: "TASK-20260708-003-new-order-dropdowns"
status: "active"
phase: "validated_touch_fix"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-09T00:00:06Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**Fix new order dropdown interactivity and sizing**

## Current state

已实现手机端新建工单品牌、型号、故障细分箭头的 tap-vs-drag 保护：轻点打开菜单，触摸拖动不打开菜单并保留页面滚动手势；新增移动端 Playwright 回归和截图。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

显式 stage 本次触控修复文件、提交并推送 main；保留现有 kiosk/settings/API WIP 未暂存。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260708-003-new-order-dropdowns/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
