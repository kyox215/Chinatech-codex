# Handoff / Resume — TASK-20260720-006-ai-ledger-fence-hotfix

## Current handoff

- **Status:** production repair applied and observed; conditional closeout pending `main` integration only.
- **Last verified:** 2026-07-20T12:59:08Z
- **Workspace/branch:** `/private/tmp/repairdesk-ai-ledger-fence-hotfix-20260720`; `codex/ai-ledger-fence-hotfix-20260720`; baseline `0a0ec0f5a7b3aa4fc992977da172732576686379`.
- **Exact release unit:** migration `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` plus its tests, docs and task memory. Migration SHA-256 is recorded in `EVIDENCE.md`.
- **Current production:** migration `20260720065246` is applied; catalog/ACL/RLS/aggregate checks, one non-PII order-text canary and 15 minutes / 16 polls passed. No open, bad, cross-store, reserved or overrun ledger state exists at the final observation point.
- **Git state:** release commit `bbdb98c1` and the final closeout commit are on `origin/codex/ai-ledger-fence-hotfix-20260720`; `main` does not yet contain the migration.
- **Required first action:** before any later database release, fetch and merge/cherry-pick this complete hotfix branch into `main`, then verify linked dry-run remains up to date. Do not reapply or repair migration history.
- **Approval boundary:** PR creation/merge, Vercel deployment, Vision smoke, flags, policy, secrets, models, quotas, lifecycle mutation and other migrations remain outside this task.
- **Rollback:** stop paid AI first; use a new forward compensating migration. Never edit history, drop the ledger or restore the faulty trigger while paid AI remains enabled.
