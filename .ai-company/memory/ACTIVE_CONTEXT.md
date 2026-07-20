---
schema_version: 1
current_task_id: "TASK-20260720-006-ai-ledger-fence-hotfix"
status: "conditional"
phase: "released_observed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L1"
owner: "IntegrationLead"
last_checkpoint_at: "2026-07-20T12:59:08Z"
checkpoint_required: false
last_rehydrated_at: null
---

# Active Context

## Current objective

**AI 用量账本门店围栏热修复**

## Current state

Owner-approved migration `20260720065246` is production-applied. Catalog/ACL/RLS/aggregate postchecks, exactly one non-PII order-text canary and 15 minutes / 16 observation polls passed; no rollback or containment was required. Release files are on `origin/codex/ai-ledger-fence-hotfix-20260720`, while `main` still lacks the migration.

## Blocking decisions

- No functional production blocker remains.
- Repository governance remains conditional: integrate the full hotfix branch into `main` before any later database release. PR/merge authorization was outside the completed release scope.

## Next action

Merge or cherry-pick the complete hotfix branch into `main` before the next database release, then confirm linked dry-run remains up to date. Do not reapply or repair the already-live migration.

## Resume protocol

1. Read `AGENTS.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
2. Read `.ai-company/memory/tasks/TASK-20260720-006-ai-ledger-fence-hotfix/TASK.md` and latest checkpoint.
3. Inspect current Git/workspace state before changing files.
4. Reclassify if scope, target environment, or risk changed.
