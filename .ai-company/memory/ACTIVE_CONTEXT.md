---
schema_version: 1
current_task_id: "TASK-20260714-001-buyback-sensitive-evidence-feature-off"
status: "in_progress"
phase: "implementation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2_execution_with_D4_owner_approval"
owner: "鹤祥"
last_checkpoint_at: "2026-07-14T13:18:54Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**回收身份证与签名采集生产关闭补丁**

## Current state

终审缺口已全部修复：旧 schema 普通附件兼容、既有 allowlisted 证据状态保留且新 marker 剥离、失败重试复用并刷新同一记录、关闭态历史凭证只读；87 项聚焦测试、909 项全量测试、构建、最终 6 项 E2E 与 SEC/UX 最终 GO 均完成。

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

重新 fetch 核对 origin/main 与精确 diff，暂存任务文件并提交推送 main；验证 Vercel 精确 SHA、HTTP/日志/生产截图，最后执行 Supabase 只读后检并关闭任务。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260714-001-buyback-sensitive-evidence-feature-off/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
