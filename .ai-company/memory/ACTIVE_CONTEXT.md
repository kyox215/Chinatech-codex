---
schema_version: 1
current_task_id: "TASK-20260720-002-print-safari-reliability-fixes"
status: "observing"
phase: "production_observing"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T14:02:00Z"
checkpoint_required: true
last_rehydrated_at: null
---

# Active Context

## Current objective

修复打印后台泄漏/分页/任务页内容与 Safari 快速接单二次点击，并推送 `main` 应用到生产。

## Current state

修复提交 `d03f8445f7b36f849804841b5c1054cde6a7b210` 已非强制推送到 `origin/main`。对应 Vercel Production `https://chinatech-codex-da9hj4yey-kyox120-9295s-projects.vercel.app` 已 READY 并绑定 `www.chinatech.in` / `chinatech.in`；构建日志确认 main commit `d03f844`。正式登录页 200，未登录 orders/task/new 路由均 307 回登录页，部署错误级日志为空。自动化门禁仍为 PASS；无 migration、依赖、环境或生产数据变更。

## Blocking decisions

- 无发布授权阻塞；Owner 已明确要求推送并应用。
- 最终物理门禁只能由真实 Safari 原生预览和店内 HP 打印机完成；部署可先进入 observing，不得在缺少实物证据时声称完整 PASS。

## Next action

在真实 Safari 原生打印预览确认只有客户票据且页数正确，并用店内 HP 打印机完成一张标准单实物验证；同时在 Safari 连续进入两次快速接单。通过后可把任务从 observing 关闭；失败则保留现场截图并回滚/修复。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-002-print-safari-reliability-fixes/TASK.md`, `CHECKPOINTS.md`, `EVIDENCE.md`, and `HANDOFF.md`.
3. Inspect current Git/workspace state before changing files.
4. Do not publish from the original dirty checkout. Current rollback deployment is `https://chinatech-codex-21k1mhy9q-kyox120-9295s-projects.vercel.app`; stop and investigate any print/intake regression, auth regression or HTTP 500.
