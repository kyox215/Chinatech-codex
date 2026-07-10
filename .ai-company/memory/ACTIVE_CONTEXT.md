---
schema_version: 1
current_task_id: "TASK-20260710-013-realtime-preload-coordination"
status: "closed"
phase: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
last_checkpoint_at: "2026-07-10T22:51:06Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**实时刷新与智能预加载一致性协调**

## Current state

实时刷新与内存级智能预加载已通过全部门禁并推送 `main`；实现提交为 `96f3197d`。生产 Realtime migration、Dashboard 与环境开关仍未授权且未执行。

## Blocking decisions

- 生产 Supabase migration、Realtime private-only Dashboard 设置和生产环境开关不包含在当前推送授权中。
- Realtime 只能传 metadata-only invalidation；业务数据只允许 React Query 会话内存缓存，不进入持久浏览器缓存。
- 原工作区存在其他未提交改动，本任务不得混入。

## Next action

无当前执行动作。生产 Realtime 激活如需继续，必须新建独立批准任务并通过 Database Application Gate。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260710-013-realtime-preload-coordination/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
