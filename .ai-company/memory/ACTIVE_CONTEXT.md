---
schema_version: 1
current_task_id: "TASK-20260720-006-ai-ledger-fence-hotfix"
status: "active"
phase: "production_release_authorized"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T12:27:58Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**AI 用量账本门店围栏热修复**

## Current state

Owner approved exact hotfix `20260720065246`. Forward migration, PostgreSQL 17 behavior/concurrency coverage, full repository gates, refreshed linked history/dry-run, zero-reservation preflight, no-concurrent-release check, documentation and DATA/SEC/QA reviews are complete. No production write has occurred yet.

## Blocking decisions

- No approval blocker remains for the exact scoped Git delivery and production migration `20260720065246`; stop on any pre-apply drift, unexpected pending migration, active release/lifecycle mutation, or nonzero reservation count.

## Next action

Create and push the scoped candidate commit, re-run the exact linked dry-run, apply only migration `20260720065246`, then execute catalog/ACL/aggregate checks, one non-PII order-text smoke and at least 15 minutes of observation.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-006-ai-ledger-fence-hotfix/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
