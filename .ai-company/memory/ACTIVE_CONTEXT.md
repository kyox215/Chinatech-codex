---
schema_version: 1
current_task_id: "TASK-20260718-014-ai-assistant-live-pilot"
status: "in_progress"
phase: "production-release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T00:52:23Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度**

## Current state

D4-v2 one-shot passed all three activation gates on `main@ec134a42`: HTTP 200; v2 ledger succeeded with one attempt and 44 micro-USD; audit succeeded; no open reservation, vision request or other-store request. Production is READY on the dormant v2 deployment and all live flags remain off until the controlled ChinaTech activation deployment.

## Blocking decisions

- Any HTTP, ledger, audit, policy-attestation, isolation, privacy, cost, or deployment failure stops activation and disables v2 if it had been enabled.
- Vision, PII, automatic writes, public/customer AI, additional stores, changed model/budget and destructive rollback remain outside scope.
- Production browser/UI verification is blocked by an explicit user restriction against using `www.chinatech.in`; do not bypass it.

## Next action

Configure only the ChinaTech allowlist plus master/order-text live flags, deploy the checkpointed exact SHA, then observe production for 30 minutes. Keep vision, draft apply, public/customer assistant, PII and all other stores off.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-014-ai-assistant-live-pilot/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
