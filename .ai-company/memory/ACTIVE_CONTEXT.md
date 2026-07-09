---
schema_version: 1
current_task_id: null
status: "idle"
phase: "none"
task_class: null
risk_level: null
autonomy_level: null
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-09T12:56:28Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

No active task.

## Current state

- Status: idle
- Latest completed task: `TASK-20260709-014-migration-history-audit`.
- The migration history audit closeout is documentation-only and records 25 local Supabase migrations absent from remote history.
- No DDL, migration apply, migration repair, or production data write was performed.
- Prior completed task: `TASK-20260709-014-imei-overlay-value-binding`.
- No task is selected for automatic resumption.

## Next action

Create a task with `python tools/ai_company.py new-task --title "..."`.
