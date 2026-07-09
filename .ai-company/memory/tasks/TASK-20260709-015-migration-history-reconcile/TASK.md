---
updated_at: "2026-07-09T13:05:17Z"
status: "closed"
closed_at: "2026-07-09T13:05:17Z"
---
# TASK-20260709-015 Migration History Reconcile

Status: review
Owner goal: Execute the migration-history audit plan, push the safe migration to main, and apply the confirmed main migration to the linked Supabase project.
Scope: Add and apply one forward-only Supabase migration that reconciles safe schema drift from historical migrations absent from remote history.
Out of scope: `supabase db push --include-all`, offline sync draft table/RPC application, direct migration-history table edits, destructive cleanup, broad app changes, and customer-facing release messaging.
Risk: R3 because this affects production database schema, Realtime authorization, tenant constraints, and migration operations.
Autonomy: L2 with explicit owner instruction to execute and apply.

Acceptance:
- Use a clean worktree based on current `origin/main`.
- Add a single idempotent migration newer than `20260709234000`.
- Verify remote preconditions and run a transaction rollback preflight.
- Commit and push only the scoped migration/task evidence.
- Apply the migration to project `xluzcoduqsdvjoouqhkc`.
- Verify the resulting indexes, constraints, trigger, and realtime policy.

Visual evidence: No UI page. Evidence is migration SQL, remote metadata checks, transaction preflight, Git commit/push, and post-apply database verification.
