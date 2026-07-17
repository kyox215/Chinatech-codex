---
schema_version: 1
current_task_id: "TASK-20260717-device-custody-compact-unlock-retention"
status: "active"
phase: "verifying"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-17T18:43:06Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**Device custody compact mobile UI and unlock retention**

## Current state

Owner approved executing the device custody compact mobile UI and unlock-retention rule, including linked Supabase migration. Implemented compressed mobile custody card, combined mobile assignee/supplier controls, retained unlock credentials across customer-held/returned custody, and added migration 20260717182220 to drop the customer-custody unlock-clear constraint and replace affected RPCs.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Stage only this task scope, commit, push main, then verify origin/main and report linked Supabase migration 20260717182220 plus screenshot screenshots/device-custody-retain-unlock-mobile.png.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260717-device-custody-compact-unlock-retention/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
