---
schema_version: 1
current_task_id: "TASK-20260718-012-workspace-integration-release"
status: "complete"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T19:46:45Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**整合并发布此前所有已完成改动，然后启动库存 V2 Phase 0**

## Current state

三个此前完成的 release unit 已安全整合并推送 main；只应用 20260718150000 门店默认值迁移且生产数据指纹不变；同 SHA Vercel 部署 READY；库存 V2 Phase 0 与默认关闭纵向切片已采纳，V2 migration、RPC、flags 和 V1 退役继续保持独立 D4 门禁。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

正式启用 Inventory V2 时，严格从 release runbook 的恢复证明、精确 linked dry-run、单独 migration/RPC 批准和单店 allowlist 开始；在此之前不执行生产变化。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-012-workspace-integration-release/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
