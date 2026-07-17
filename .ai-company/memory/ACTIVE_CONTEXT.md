---
schema_version: 1
current_task_id: "TASK-20260717-005-store-identity-hardcode-removal-plan"
status: "planned"
phase: "implementation"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L1_for_production_customer_output"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-17T19:12:03Z"
checkpoint_required: false
last_rehydrated_at: null
---
# Active Context

## Current objective

**移除客户可见 Chinatech 硬编码并建立多店铺输出身份**

## Current state

Implemented store-aware public customer output identity: public_base_url settings field, fail-closed customer/order links, neutral auth/onboarding/sidebar copy, internal print QR path fallback, Chinatech legal buyback profile restriction, and Supabase migration 20260717185048. Validation evidence: lint pass, typecheck pass, full vitest rerun 207 files/1422 tests pass, Next build pass, Supabase migration list aligned, dry-run up to date, db lint no schema errors. Resolved duplicate local migration file after first Supabase push applied the full SQL under a duplicate filename; kept one standard local migration file.

## Blocking decisions

- None recorded. Check the task file and `OPEN_CONFLICTS.md` before assuming this remains true.

## Next action

Before closing, validate scoped diff, stage only task-owned files, commit and push main. Do not stage unrelated scan/capture/order-screen dirty worktree files. If post-push deployment is checked, verify production customer message/settings flow and avoid production DML unless Owner approves exact preview rows.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260717-005-store-identity-hardcode-removal-plan/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
