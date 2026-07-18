---
schema_version: 1
current_task_id: "TASK-20260718-012-workspace-integration-release"
status: "in_progress"
phase: "03_validation"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
last_checkpoint_at: "2026-07-18T20:35:00+02:00"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

Validate and release the three scoped prior-change units, then start Inventory V2 Phase 0.

## Current state

- Phase 01 inventory and Phase 02 latest-main integration are complete.
- Three scoped commits are ready for full validation.
- No production database or deployment action has run yet.

## Next action

Run repository checks, full tests/build, device/settings/order browser flows and screenshots; then proceed to the exact Supabase dry-run gate.
