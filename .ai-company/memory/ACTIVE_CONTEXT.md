---
schema_version: 1
current_task_id: "TASK-20260720-003-store-self-service-purge"
status: "active"
phase: "review"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T23:17:55Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**空测试店铺永久删除与用户自助删除流程**

## Current state

功能分支已以非强制方式推送到 origin/codex/store-self-service-purge，远端与本地均为 943d77c0；未合并 main、未部署、未应用迁移、未执行删除。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

保持生产 NO-GO；如继续进入 main 审查，先完成 disposable DB 双会话证明、加密 sink、隔离恢复、runner 与桌面/移动可视证据，并单独取得生产阶段批准。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-003-store-self-service-purge/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
