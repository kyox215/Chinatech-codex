# Handoff / Resume — TASK-20260720-006-ai-ledger-fence-hotfix

## Current handoff

- **Status:** validated release candidate; waiting for explicit Owner production approval.
- **Last verified:** 2026-07-20T07:25:00Z
- **Workspace/branch:** `/private/tmp/repairdesk-ai-ledger-fence-hotfix-20260720`; `codex/ai-ledger-fence-hotfix-20260720`; baseline `0a0ec0f5a7b3aa4fc992977da172732576686379`.
- **Exact release unit:** migration `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` plus its tests, docs and task memory. Migration SHA-256 is recorded in `EVIDENCE.md`.
- **Current production:** faulty generic trigger remains; AI paid path is fail-closed before provider dispatch. No open/expired reservation exists. No production write was made by this task.
- **Required first action:** fetch and confirm `origin/main` has not moved; re-run `git diff --check`, migration SHA, linked history and dry-run. If the branch is stale, reconcile in a fresh isolated worktree and repeat gates.
- **Approval boundary:** do not commit/push/apply/deploy until the Owner explicitly approves the exact production hotfix. Do not change Vision, flags, policy, secrets, Vercel, or other migrations.
- **After approval:** follow `RELEASE_PLAN.md`; apply exactly one migration, run catalog/ACL/aggregate checks, one non-PII order-text smoke and a minimum 15-minute observation.
- **Rollback:** stop paid AI first; use a new forward compensating migration. Never edit history, drop the ledger or restore the faulty trigger while paid AI remains enabled.
