# Handoff

## Current State

Phase 3 is implemented and verified.

Implemented through Phase 3:

- Customer detail is profile-first and order-centered.
- Device tab shows linked order statistics, latest order, warranty label, active repair count, and unpaid amount.
- Device cards now open a near-full-screen mobile bottom Sheet for device details.
- The Sheet shows device identity, 2x2 statistics, current risk, all linked order history, and sticky actions.
- Device deletion is safer: devices with linked historical orders hide the destructive delete action and show the retention reason; devices without linked orders require confirmation before hard delete.
- No database migration, production deployment, permission model change, or customer merge/deduplication was performed.

## Read First

1. `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md`
2. `src/features/customers/model/customer-list.ts`
3. `src/features/customers/screens/customer-detail-screen.tsx`
4. `src/features/customers/components/customer-detail-panels.tsx`
5. `src/features/customers/components/customer-profile-blocks.tsx`
6. `src/features/customers/server/customer.repository.ts`
7. `src/lib/repairdesk/types.ts`

## Relevant Files

- `src/features/customers/model/customer-workbench.ts`
- `src/features/customers/model/customer-workbench.test.ts`
- `src/features/customers/components/customer-device-sheet.tsx`
- `src/features/customers/components/customer-profile-blocks.tsx`
- `src/features/customers/components/customer-detail-panels.tsx`
- `src/features/customers/screens/customer-detail-screen.tsx`
- `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-devices-phase3-history.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-phase3-mobile-device-sheet-393-prod.png`

## Latest Validation

- `npm run test -- src/features/customers/model/customer-workbench.test.ts src/features/customers/testing/mock-api.test.ts src/features/customers/server/customer.repository.test.ts`: passed, 3 files / 16 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed after running outside the sandbox because Turbopack port binding is blocked inside the sandbox.
- Production-preview mobile screenshot and metrics passed at 393px: `scrollWidth=393`, `innerWidth=393`, `hasOverflow=false`, linked-order device `hardDeleteVisible=false`.
- Screenshot: `customer-phase3-mobile-device-sheet-393-prod.png`.

## Next Recommended Action

Push/apply the scoped Phase 3 bottom Sheet implementation. Phase 4 true device archive semantics remain a separate decision because archive behavior may need schema/API work.

## Stop Conditions

Pause before:

- Any database migration.
- Any customer merge/deduplication behavior.
- Any permission model change.
- Any production deployment.
