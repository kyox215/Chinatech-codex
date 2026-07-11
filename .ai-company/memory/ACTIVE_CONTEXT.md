---
schema_version: 1
current_task_id: "TASK-20260711-002-order-detail-preload-skeleton"
status: "in_progress"
phase: "release"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
last_checkpoint_at: "2026-07-11T00:19:35Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**订单详情预加载与订单客户全框架骨架屏**

## Current state

实现、审查修复和最终质量门已完成。订单/客户/详情使用完整骨架；订单详情由订单列表单一调度器有界预取；热缓存、后台刷新、Realtime/store epoch 和 store shell 终态均已验证。当前只剩范围化提交、推送和远端哈希确认。

## Blocking decisions

- 不修改生产 Supabase、Realtime private-only Dashboard 或环境开关。
- 订单详情读取较重，只允许首屏少量和用户意图预取，不允许整页 50 条预取。
- Realtime 必须优先于旧预取；业务数据只保存在 React Query 会话内存。
- 原工作区存在其他未提交改动，本任务不得混入。

## Next action

接收最终 QA 确认，fetch 最新 origin/main；如未前进则提交 scoped diff 并推送 `HEAD:main`，随后验证远端哈希并关闭任务。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read .ai-company/memory/tasks/TASK-20260711-002-order-detail-preload-skeleton/TASK.md and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
