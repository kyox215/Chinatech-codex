---
schema_version: 1
current_task_id: "TASK-20260718-013-inventory-v2-production-canary"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T21:05:28Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**库存商品 V2 生产恢复门禁与 Chinatech 单店灰度**

## Current state

最终候选链在全新 PostgreSQL 17 生产快照恢复库通过：116 张原表、40,458 行逐表一致；修复 V2 售出投影并新增单店影子对账，事务回滚、RLS/ACL、297 files/1862 tests、lint、typecheck、build 均通过。生产数据库和 flags 未变更；AI 成本治理 migration 仍需 Owner 独立 D4 批准。

## Blocking decisions

- Owner must explicitly approve applying the independent `20260718174042_ai_assistant_cost_governance_v1.sql` migration before the linked Inventory V2 migrations. Until then, production database apply and all Inventory V2 flags remain unchanged.

## Next action

提交当前 default-off 变更，rebase origin/main 并复验后非强制推送 main；之后等待 Owner 明确批准 AI migration，禁止 --include-all，批准前不 apply 生产或开灰度。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-013-inventory-v2-production-canary/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
