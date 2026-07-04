---
updated_at: "2026-07-04T16:30:53Z"
---
# TASK-20260704-004-order-mobile-filter-touch-sort

## Status

- status: verified
- owner: Integration Lead / CEO Agent
- autonomy_level: L2 controlled execution
- risk_level: R1 low
- created_at: 2026-07-04T15:37:13Z
- last_verified_at: 2026-07-04T15:37:13Z

## Owner Goal

Optimize the mobile orders page for touch accuracy and display stability. The mobile filter sheet must be easier to tap and scroll, and order cards must sort by simple repair progress from low to high, 1/5 through 5/5.

## In Scope

- Mobile order list header touch targets.
- Mobile order filter sheet density, scroll behavior, and bottom action bar spacing.
- Shared sheet close target size.
- Order list sorting in Supabase-backed repository and mock API.
- Regression coverage for simplified progress sorting.
- Mobile screenshot evidence at 393 x 852.

## Out of Scope

- Production deployment.
- Database schema or migration changes.
- Payment, permission, or customer communication changes.
- Redesign of unrelated order detail cards.

## Decisions

- Use the existing `getSimpleOrderFlowStageIndexForWorkflow` helper as the first sort key.
- Preserve detailed workflow status order as a secondary sort key.
- Keep order list card layout compact, but enlarge actionable mobile targets to 40-44px.
- Keep checkbox visual controls small inside 44px label rows; the row is the intended tap target.

## Acceptance Criteria

- Mobile header menu, create, filter, sheet close, filter chips, technician rows, supplier rows, and apply/reset buttons are easier to tap.
- Filter sheet can scroll to technician and supplier options without hiding the apply button.
- `/orders` cards show progress-sorted groups from 1/5 to 5/5.
- No mobile page-level horizontal overflow at 393px.
- Lint, typecheck, full tests, and build pass.

## Files Changed

- `src/components/ui/sheet.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/testing/mock-api.ts`
- `src/features/orders/testing/mock-api.test.ts`

## No-Spawn Reason

No sub-agents were spawned. The task was a bounded mobile UI and ordering fix with a single write ownership area; spawning multiple agents would add coordination overhead and potential conflict without materially reducing risk.
