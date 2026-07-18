---
schema_version: 1
current_task_id: "TASK-20260718-013-inventory-v2-production-canary"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T21:11:23Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**库存商品 V2 生产恢复门禁与 Chinatech 单店灰度**

## Current state

休眠修复已非强制快进推送 main@92d7cdad；Vercel exact-SHA production deployment READY。登录 200、库存未登录 307 到登录、影子对账 API 未登录 401。敏感生产快照临时容器和目录已永久清除。生产 Supabase migration history 与 Inventory V2 flags 仍未改变。

## Blocking decisions

- Owner must explicitly approve applying the independent `20260718174042_ai_assistant_cost_governance_v1.sql` migration before the linked Inventory V2 migrations. Until then, production database apply and all Inventory V2 flags remain unchanged.

## Next action

等待 Owner 明确批准先应用独立 AI 成本治理 migration；批准后重新 fetch、linked dry-run 与生产前置检查，再串行 apply 四份 migration，先 schema+shadow+Chinatech allowlist 对账，随后 commands/UI 单店灰度。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-013-inventory-v2-production-canary/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
