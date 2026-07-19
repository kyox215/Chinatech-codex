---
schema_version: 1
current_task_id: "TASK-20260718-014-ai-assistant-live-pilot"
status: "in_progress"
phase: "production-release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-19T00:25:55Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度**

## Current state

D4-v2 is explicitly approved. Original D4 settled one 123 micro-USD request but stopped on HTTP/audit failure; ChinaTech was never activated, all Production live flags remain off, `ai-runtime-v1` is disabled and no reservation is open. The safe `ai-runtime-v2` candidate adds only explicit GPT-5 nano minimal reasoning and is isolated on `codex/ai-v2-d4-release-20260719` under one production release lock. Production remains READY on `main@bc5dfae3` until the dormant v2 deployment gate.

## Blocking decisions

- Any HTTP, ledger, audit, policy-attestation, isolation, privacy, cost, or deployment failure stops activation and disables v2 if it had been enabled.
- Vision, PII, automatic writes, public/customer AI, additional stores, changed model/budget and destructive rollback remain outside scope.
- Production browser/UI verification is blocked by an explicit user restriction against using `www.chinatech.in`; do not bypass it.

## Next action

Refresh Supabase/Vercel production baselines, insert a disabled exact-copy v2 policy, then deploy v2 with every live flag still off before attestation and the one authorized service-path smoke.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-014-ai-assistant-live-pilot/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
