# Stage 07 — Production Release and Observation

Status: pending

## Goal

Apply only reviewed TASK-008 migrations, fast-forward `main`, deploy the exact commit and verify production behavior.

## Sequence

1. Acquire the serialized release lock and re-fetch `origin/main`.
2. Rebase/reconstruct on current remote if required; rerun affected gates.
3. Verify linked migration history and production data volume/metadata.
4. Run an exact `supabase db push --linked --dry-run`; stop on any unrelated migration.
5. Verify backup/recovery and rollback evidence required by the Database Application Gate.
6. Apply only TASK-008 additive migrations and immediately verify history, tables, constraints, indexes, RLS, ACL and RPC execution grants.
7. Push the reviewed commit fast-forward to `main`.
8. Confirm Vercel READY for the same SHA; keep high-risk capabilities feature-gated until schema checks pass.
9. Run Owner/authorized-Manager/unauthorized production smoke without exposing PII.
10. Inspect runtime errors and business invariants during the observation window.

## Rollback

- Disable individual Phase 2 feature flags first.
- Revert or roll back the application deployment when code behavior is unsafe.
- Preserve additive schema/audit records and use forward fixes; do not drop cost history in an emergency.
- Do not execute historical backfill automatically as part of deployment.

## Exit criteria

- Remote `main`, production deployment and reported SHA match.
- Linked migration history and metadata checks pass.
- Production smoke, screenshots and runtime error scan pass.
- Observation result and rollback reference are recorded before closeout.
