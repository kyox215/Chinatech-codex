# Checkpoints — TASK-20260721-002-order-deposit-correction-release

## 2026-07-21T12:17:46Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-21T12:17:56Z — Ported bounded initial-deposit correction onto isolated origin/main worktree. Sales and assigned technicians are authorized; viewer and unassigned technicians are denied. Atomic service-role RPC, audit ledger, event, strict schema, desktop/mobile UI and documentation are present.

- **Phase:** release-candidate-validated
- **Completed/current state:** Ported bounded initial-deposit correction onto isolated origin/main worktree. Sales and assigned technicians are authorized; viewer and unassigned technicians are denied. Atomic service-role RPC, audit ledger, event, strict schema, desktop/mobile UI and documentation are present.
- **Next:** Review final diff, commit and push release branch; apply the sole dry-run-confirmed migration; verify schema/grants/RPC; deploy Vercel preview then production and capture visual evidence.
- **Decision:** Use isolated worktree and branch from origin/main; deploy database before application; do not widen technician collection/refund/payment-adjust permissions.
- **Blocker:** Full suite has 7 unrelated existing UI failures/timeouts (2163 passed); no blocking failure in changed surface. ACTIVE_CONTEXT remains owned by parallel store purge task and was not switched.
- **Evidence:**
  - Targeted Vitest: 5 files, 146 tests passed; npm typecheck passed; npm lint passed; production build passed; Supabase dry-run would push only 20260721133000_order_initial_deposit_correction.sql.
- **Recorded by:** RepairDesk Integration Lead
## 2026-07-21T12:45:58Z — Production database and application release completed. Migration 20260721133000 is present remotely; linked transactional SQL reached assertion 21 and rolled back. Preview artifact was promoted to production deployment dpl_BiJXkZY5hpCFeJRbcFYQzn4cEwXj, which is READY and owns the production aliases.

- **Phase:** production-released
- **Completed/current state:** Production database and application release completed. Migration 20260721133000 is present remotely; linked transactional SQL reached assertion 21 and rolled back. Preview artifact was promoted to production deployment dpl_BiJXkZY5hpCFeJRbcFYQzn4cEwXj, which is READY and owns the production aliases.
- **Next:** Owner may perform an authenticated order-detail smoke with a Sales account and an assigned Technician account; no further release write is required for this task.
- **Decision:** Close conditionally because production is live and all technical gates passed, while authenticated order-page visual smoke could not be run without credentials. Rollback is Vercel alias rollback plus forward RPC revocation; preserve correction audit history.
- **Blocker:** Authenticated production order-detail screenshot is login-gated. This does not block the deployed API/database/UI artifact but remains owner-observable follow-up.
- **Evidence:**
  - Commit history through 676fc6d8 on origin/codex/order-deposit-correction; 146/146 focused tests; typecheck/lint/build pass; full suite 2163/2170 with 7 unrelated existing UI failures; Supabase migration list parity; Vercel READY; production login page screenshot at artifacts/deposit-production-login.png.
- **Recorded by:** RepairDesk Integration Lead
## 2026-07-21T12:46:14Z — Task closeout

- **Status:** conditional
- **Outcome:** Initial-deposit correction is live in Supabase and Vercel Production with bounded Sales/assigned-Technician authorization, atomic audit history, focused application gates and linked SQL verification.
- **Residual risks:** Authenticated order-detail visual smoke was not executed because the browser had no production login; full suite retains seven unrelated existing UI failures.
- **Follow-up:** Owner or authorized staff should confirm the button/dialog once with Sales and once with an assigned Technician during normal use; reopen only if live behavior differs.
- **Closed by:** RepairDesk Integration Lead
