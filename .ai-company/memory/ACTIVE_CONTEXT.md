---
schema_version: 1
current_task_id: "TASK-20260718-014-ai-assistant-live-pilot"
status: "conditional"
phase: "post-release-observation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T01:46:28Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度**

## Current state

D4-v2 ChinaTech employee order-text is live on main@152caa1c. The no-PII v2 one-shot passed HTTP, ledger and audit with one 44-microUSD attempt; the full 30-minute observation ended with zero open, bad, overrun, Vision, cross-store or scoped runtime-error counts. Vision, PII, writes, public AI and other stores remain off.

## Blocking decisions

- Vision, PII, automatic writes, public/customer AI, another store, or any model/budget change requires a new R4/D4 task.
- Authenticated production UI evidence remains blocked by the explicit `www.chinatech.in` site-use restriction; do not bypass it.
- Any policy, tenant, privacy, budget, ledger, audit or runtime stop threshold requires flags-first rollback and v2 disablement.

## Next action

At or after 2026-07-20T00:58:50Z, perform one read-only 24-hour policy, ledger, audit and Vercel runtime review without another provider smoke. Any expansion requires a new R4/D4 task.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-014-ai-assistant-live-pilot/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
