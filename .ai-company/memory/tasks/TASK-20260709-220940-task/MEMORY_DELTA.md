# Memory Delta — TASK-20260709-220940-task

## Candidate project facts

- 2026-07-10 `TASK-20260709-220940-task` scoped-verified linked Supabase migration history alignment through `20260709235000`, dry-run up to date, and `store_member_permission_grants` live table posture (`relrowsecurity=true`, table grants limited to `postgres` and `service_role`). Status: verified for this scoped table/history only, not broad production parity.
- 2026-07-10 original checkout was protected and synchronized: branch `preserve/original-main-before-sync-20260710-0030` keeps old `19e22798`, `stash@{0}` keeps dirty/untracked work, and local `main` now matches pushed `origin/main` at `961e186b`. Status: observed, workspace-hygiene fact.

## Candidate department updates

- Data/Security: record scoped Supabase evidence and the lesson to rerun `supabase db query --linked` serially after pooler/circuit-breaker failures; do not infer table absence from that CLI failure.
- Operations: replace stale "worktree currently dirty" memory with current protected/synced state and recovery handles.
- Documentation: docs were synchronized so Phase 5R historical mismatch is not treated as a current blocker.

## Candidate decisions / ADRs

- No new ADR. This task did not approve broad production DB repair, production data deletion, or Phase D2 UI redaction implementation.

## Candidate lessons and capability evidence

- Serial linked Supabase queries can recover after prior parallel pooler auth/circuit-breaker failures; keep DB verification queries serial unless there is a strong reason to parallelize.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
