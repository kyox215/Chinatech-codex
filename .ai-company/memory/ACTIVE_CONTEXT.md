---
schema_version: 1
current_task_id: "TASK-20260719-007-ai-natural-language-query-v3"
status: "in_progress"
phase: "release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T20:20:03Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**AI 自然语言订单查询 V3 准确性、任意日期与范围上线**

## Current state

任意日期、closed-world 语义编译、设备边界和可折叠可解释 UI 已完成；最新 main 基线上 lint、typecheck、2,033 tests、Webpack build、核心 E2E 和响应式截图已通过。当前进入 exact-SHA 发布阶段。

## Blocking decisions

- 不允许数据库迁移、秘密变更或生产写操作；若出现必须暂停重新审批。

## Next action

冻结并提交本任务差异，fetch/rebase 门禁后非强制推送 `HEAD:main`，验证 Vercel exact-SHA READY、生产域名和无 PII 冒烟。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260719-007-ai-natural-language-query-v3/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
