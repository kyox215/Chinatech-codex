---
schema_version: 1
current_task_id: "TASK-20260711-002-order-detail-preload-skeleton"
status: "closed"
phase: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
last_checkpoint_at: "2026-07-11T00:25:27Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**订单详情预加载与订单客户全框架骨架屏**

## Current state

订单/客户/详情全框架骨架和订单详情有界预取已通过全部门禁与独立复核，并推送 `main`；实现提交为 `4e60e2d9`。生产数据库、Dashboard、Realtime 环境开关与生产数据未变更。

## Blocking decisions

- 不修改生产 Supabase、Realtime private-only Dashboard 或环境开关。
- 订单详情读取较重，只允许首屏少量和用户意图预取，不允许整页 50 条预取。
- Realtime 必须优先于旧预取；业务数据只保存在 React Query 会话内存。
- 原工作区存在其他未提交改动，本任务不得混入。

## Next action

无当前执行动作。若未来需要无重建的运行时预取熔断或生产预取指标，必须新建独立架构/发布任务。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read .ai-company/memory/tasks/TASK-20260711-002-order-detail-preload-skeleton/TASK.md and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
