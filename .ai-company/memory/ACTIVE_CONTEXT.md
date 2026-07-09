---
schema_version: 1
current_task_id: null
status: "idle"
phase: "none"
task_class: null
risk_level: null
autonomy_level: null
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-09T12:10:53Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

No active task.

## Current state

- Status: idle
- Latest completed task: `TASK-20260709-014-imei-overlay-value-binding`.
- The IMEI scanner overlay binding fix was validated with focused Vitest, parser tests, typecheck, lint, full Vitest, production build, and IMEI Playwright UI smoke.
- Visual evidence is stored in `screenshots/TASK-20260709-014-imei-overlay-value-binding/`.
- No task is selected for automatic resumption.

## Next action

Create a task with `python tools/ai_company.py new-task --title "..."`.
