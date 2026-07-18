---
schema_version: 1
current_task_id: "TASK-20260718-013-inventory-v2-production-canary"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T20:19:18Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**库存商品 V2 生产恢复门禁与 Chinatech 单店灰度**

## Current state

最终 linked dry-run 发现新主线中的 20260718174042_ai_assistant_cost_governance_v1.sql 先于三条 Inventory V2 migration 且仍属 task-011 明确 D4 未批准 apply。恢复、迁移演练、安全矩阵、1858 tests 和 build 仍通过；生产数据库与 flags 未变更。

## Blocking decisions

- `20260718174042_ai_assistant_cost_governance_v1.sql` 的生产 apply 仍需 Owner 独立 D4 决定；TASK-011 的 dormant closeout 未授权 apply。
- 真实付费 AI、密钥、预算、隐私、policy seed 或 AI/public activation 保持关闭。
- 库存 V1 写入关闭、全店 V2 开放、删除 V1/V2 数据或不可逆回滚均未批准。

## Next action

先把默认关闭且已验证的 migration 修复和证据非强制推送 main，验证 exact-SHA dormant deployment；随后等待 Owner 对 AI 成本治理 migration 是否可先 apply 的独立 D4 决定，禁止 --include-all 或绕过历史。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-013-inventory-v2-production-canary/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
