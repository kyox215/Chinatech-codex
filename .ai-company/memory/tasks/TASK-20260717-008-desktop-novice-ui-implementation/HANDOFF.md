# Handoff

## Current state

Closed and production-verified. Business release `main@f39f9b8400a16e6f6ba7ec7c2e6f3838fd5b07b7` is live through Vercel deployment `dpl_7yH1MgiVAR3xGV4ZGvNfSn5NHoh6`; independent read-only re-audit returned GO. Linked Supabase is current and this task required no database write.

## First resume action

1. Read `CEO_REPORT.md`, `EVIDENCE.md`, and the latest checkpoint before any follow-up.
2. Reproduce a reported issue against the exact role, order lifecycle and viewport; do not weaken the one-primary-action or permission rules.
3. Keep migration `20260717182220` intact. Any later database change requires a new reviewed forward migration and linked dry-run.

## Stop conditions

- A follow-up would relax permission, tenant, payment, audit or credential-boundary rules.
- Linked Supabase reports a pending migration or migration-history mismatch.
- A reported regression cannot be reproduced without production customer data or secrets.

## Rollback

- Revert `f39f9b8400a16e6f6ba7ec7c2e6f3838fd5b07b7` or promote the preceding READY application deployment.
- Do not remove or reverse existing custody migration `20260717182220`; use a reviewed forward fix for any database issue.
