# CEO Closeout — Global Staff Permissions

## Business outcome

- The policy applies to every RepairDesk store; there is no ChinaTech-only branch.
- Paid-and-closed and cancelled orders leave the default order queue while paid-active and completed-unpaid orders remain visible.
- Technicians and front desk can see amounts on authorized individual orders, but cannot read store totals, profit or bulk exports. Owners retain full authority; manager grants remain owner-controlled.
- Technician order access uses stable same-store membership IDs. Before the pending assignment migration, technician legacy-order access fails closed.

## Verification

- `agents:check`, lint and typecheck passed.
- Full Vitest passed: 119 files / 800 tests.
- Production build passed: 22 routes.
- Linked Supabase dry-run passed and lists exactly two pending migrations; no production apply occurred.
- Independent security review passed after testing renamed/inactive legacy assignees, kiosk-session PII access and 401/403 cache revocation.
- Desktop/mobile screenshots and zero browser console errors are indexed in `EVIDENCE.md`.
- Feature commit `397901b52751b737017a7d0749ac00edbabd6b24` was pushed and verified on remote `main`.

## Residual risk and release boundary

- Production must apply and verify the two pending migrations through a separately approved database release. Until assignment migration, technicians cannot access legacy orders; owners/managers remain available to correct unresolved assignments.
- The independent risk covering 17 legacy public tables with disabled RLS/direct browser grants remains a production NO-GO work package and is not claimed resolved here.
- Rollback is a code revert plus the migration-specific rollback plan in `docs/ROLE_PERMISSION_CONFIGURATION_PLAN.md`; no customer, finance, status or repair-content data was changed by this task.
