---
schema_version: 1
current_task_id: "TASK-20260718-011-ai-assistant-cost-governance"
status: "active"
phase: "release_candidate"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-18T19:27:37Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**RepairDesk AI 小助手 Phase 3A 成本治理与默认关闭发布**

## Current state

Phase 3A 的零模型订单路由、固定运行策略、成本估算、持久额度网关、审计最小化、本地优先图片识别和默认关闭边界已经实现。当前正在把候选安全重放到最新 `origin/main`，之后必须重新通过发布差异检查与只读终审，才能推送和部署。

## Blocking decisions

- 真实 OpenAI 调用、API Key 配置或读取。
- 生产成本治理迁移 apply。
- 数字化生产预算与门店策略启用。
- 真实文本/图片处理及 DPA/ZDR/EU 区域、保留、删除和供应商依赖批准。
- 任意 AI/public capability 或 rollout flag 激活。

## Next action

完成最新主线整合，更新发布证据和正式检查点；仅在 P0/P1 为零后执行非强制推送、默认关闭部署和 exact-SHA 生产冒烟。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-011-ai-assistant-cost-governance/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
