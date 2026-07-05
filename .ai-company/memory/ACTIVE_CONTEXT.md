---
schema_version: 1
current_task_id: "TASK-20260705-006-customer-workbench-planning"
status: "active"
phase: "implementation"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
last_checkpoint_at: "2026-07-05T23:21:20Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**TASK-20260705-006-customer-workbench-planning**

## Current state

Fix Vercel production build after customer device sheet push: latest deployment failed because main lacked store-scoped customersKeys.detail/list signatures. Added shared storeQueryScope helper and updated customer query keys; local lint, typecheck, customer tests, and next build pass.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Stage only src/features/customers/api/query-keys.ts and src/shared/lib/store-query-scope.ts, commit, push main, then monitor Vercel until production deployment is Ready.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260705-006-customer-workbench-planning/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
