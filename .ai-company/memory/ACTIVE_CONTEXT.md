---
schema_version: 1
current_task_id: "TASK-20260719-001-ai-inventory-live-provider"
status: "active"
phase: "release-candidate-verified"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T12:26:26Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**Chinatech 库存入库 AI 图片标签识别真实接入**

## Current state

客户端 effect 自取消根因已修复；方案 A 已落地。focused 5/43、全仓 309/1978、lint/typecheck/agents、26 页构建、audit 0、旧入口 6/6、V2 3/3 与三项独立复核通过。生产 Vision 保持关闭，唯一 smoke 未消耗。

## Blocking decisions

- Production Vision must remain disabled until the exact pushed SHA is deployed dormant and live policy/auth/ledger checks show the approved ChinaTech-only zero baseline.
- The one authorized synthetic no-PII smoke is non-retryable; any `sent_unknown`, provider attempt other than 1, ledger/audit delta other than `+1`, open hold, privacy mismatch or automatic inventory write triggers flags-first rollback.

## Next action

提交 scoped candidate，重新 fetch 并 fast-forward 推送 main；把三项 Vision 变量明确设为 0 后休眠部署，验证 exact SHA 与零账本，再按 runbook 执行唯一一次事先目检的合成规格图 smoke。

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260719-001-ai-inventory-live-provider/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
