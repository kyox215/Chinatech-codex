---
schema_version: 1
current_task_id: "TASK-20260718-001-order-cost-defaults"
status: "active"
phase: "implementation"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2_code_L1_production_owner_approved"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-17T22:32:53Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**订单内部成本与默认成本权限化实施发布**

## Current state

权限切片完成并已复验：finance:cost_manage 独立敏感授权、manager-only grant、成员权限选项、严格 feature flag StoreContext 投影均已实现。主线程已补 StorePermissionAction/StoreContext 类型；npm run typecheck 通过，目标测试 4 文件 84 用例通过。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

主线程在 OrderCapabilities 类型与 projectOrderCapabilities 中加入 can_read_internal_costs/can_manage_internal_costs，随后继续成本 API、迁移和 UI 集成。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-001-order-cost-defaults/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
