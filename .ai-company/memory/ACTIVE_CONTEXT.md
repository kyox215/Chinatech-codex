---
schema_version: 1
current_task_id: "TASK-20260717-005-store-identity-hardcode-removal-plan"
status: "planned"
phase: "implementation"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L1_for_production_customer_output"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-17T19:29:40Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**移除客户可见 Chinatech 硬编码并建立多店铺输出身份**

## Current state

Post-review fix: removed unrelated rollback function from 20260717185048 migration, added 20260717212000 hardening migration, applied linked Supabase migration, verified remote migration history and strict public_base_url constraint. Validation: targeted tests 7 files/88 tests pass, full vitest 204 files/1417 tests pass, typecheck pass, build pass after sandbox-external rerun, targeted eslint pass; full lint blocked only by unrelated untracked order-edit-save files. Screenshots captured for login/register debranding.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Stage only store-identity migration fix and checkpoint files, commit, push main, then report Supabase and validation evidence plus unrelated local dirty-worktree limitations.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260717-005-store-identity-hardcode-removal-plan/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
