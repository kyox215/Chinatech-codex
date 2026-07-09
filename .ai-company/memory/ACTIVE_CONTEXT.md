---
schema_version: 1
current_task_id: null
status: "idle"
phase: "none"
task_class: null
risk_level: null
autonomy_level: null
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-09T11:20:10Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

No active task.

## Current state

- Status: idle
- Latest completed task: `TASK-20260709-013-imei-locked-frame-multi-candidates`.
- Previous completed task on main: `TASK-20260709-011-private-store-suppliers`.
- The IMEI scanner locked-frame multi-candidate implementation was validated with focused component test, typecheck, lint, full Vitest, build outside sandbox, and IMEI Playwright smoke.
- Implemented private per-store supplier management, Settings supplier UI, and order parts-supplier selection integration in isolated worktree `/private/tmp/repairdesk-private-suppliers-20260709`.
- Release caveat: linked Supabase migration dry-run could not run in the isolated worktree because Supabase CLI had no project ref; repeat from a linked checkout before applying production migration.
- No task is selected for automatic resumption.

## Next action

Create a task with `python tools/ai_company.py new-task --title "..."`.
