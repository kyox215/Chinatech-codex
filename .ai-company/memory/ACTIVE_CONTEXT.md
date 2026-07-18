---
schema_version: 1
current_task_id: "TASK-20260718-013-inventory-v2-production-canary"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T20:27:57Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**库存商品 V2 生产恢复门禁与 Chinatech 单店灰度**

## Current state

默认关闭代码已非强制快进到 main@19c4feb8；Vercel production dpl_FE2Xa6p9nZ8NGNms9zmVfCzoUhvV exact-SHA READY。生产 env-name-only 检查无 Inventory V2/AI/OpenAI 变量，登录/库存鉴权/API 401 冒烟和 error-log 检查通过。生产数据库与 flags 未变更；更早且未批准的 AI 成本治理 migration 继续阻断精确 V2 apply。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

等待 Owner 独立 D4 决定：是否批准先应用 20260718174042_ai_assistant_cost_governance_v1.sql。若批准，必须重新 fetch、linked dry-run、恢复/RLS/grant preflight 后串行 apply；禁止 --include-all。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-013-inventory-v2-production-canary/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
