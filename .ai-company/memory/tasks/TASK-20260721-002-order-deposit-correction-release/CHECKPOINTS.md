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
