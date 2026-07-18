---
schema_version: 1
current_task_id: "TASK-20260718-014-ai-assistant-live-pilot"
status: "active"
phase: "production-release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T23:05:01Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度**

## Current state

Phase 3B local candidate is rebasing onto the completed Inventory V2 production baseline. Owner explicitly approved the exact D4 packet: ChinaTech-only canary `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`, USD 50 monthly hard cap, non-PII staff order text only with vision off, migration `20260718223739`, Production secrets/flags, push/deploy, one service-path billable smoke, and a 30-minute observation with written rollback thresholds. Production mutations have not started yet.

## Blocking decisions

- No owner decision is blocking the exact approved D4 packet. Any scope expansion, second store, vision, PII, automatic write, or changed budget/model requires a new D4 decision.

## Next action

Finish the rebase, record D4 approval in the task ledger, rerun release gates, then execute the production migration, policy, Vercel configuration, canary deployment, billable smoke, observation, and rollback-or-retain decision in the approved order.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260718-014-ai-assistant-live-pilot/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
