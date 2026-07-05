# Handoff

## Current State

Planning phase is complete and waiting for owner choices.

Primary plan:

- Use `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md`.
- Default choices are all A.
- Start implementation with derived customer workbench model before UI reshuffle.

## Read First

1. `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md`
2. `src/features/customers/model/customer-list.ts`
3. `src/features/customers/screens/customer-detail-screen.tsx`
4. `src/features/customers/components/customer-detail-panels.tsx`
5. `src/features/customers/components/customer-profile-blocks.tsx`
6. `src/features/customers/server/customer.repository.ts`
7. `src/lib/repairdesk/types.ts`

## First Action After Owner Confirms

Create `src/features/customers/model/customer-workbench.ts` and test file, deriving:

- customer current matters.
- payment summary.
- orders grouped by device.
- unknown/historical device fallback groups.

## Stop Conditions

Pause before:

- Any database migration.
- Any customer merge/deduplication behavior.
- Any permission model change.
- Any production deployment.
