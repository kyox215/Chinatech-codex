# Handoff

Task ID: `TASK-20260701-007-performance-optimization-plan`

## Current State

The owner approved execution with "开始执行" and then "继续". Batch 1 through Batch 5 have been implemented and verified.

Primary artifact:

- `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`
- `src/lib/query-performance.ts`
- `src/components/use-command-palette.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/api.test.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/api/query-keys.ts`
- `src/features/dashboard/screens/dashboard-screen.tsx`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/inventory/api/query-keys.ts`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/inventory/server/inventory.service.ts`
- `src/features/inventory/testing/mock-api.ts`
- `src/lib/mock/api.ts`

## Batch 1 Completed

- Shared React Query defaults and cache times.
- Command palette body lazy loading.
- Hot-path stale times and invalidation cleanup.
- Deferred inventory/buyback search query inputs.
- Screenshot evidence: `screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png`.

## Batch 2 Completed

- Added default timeout/cancel handling to the RepairDesk API client.
- Added `RepairDeskRequestOptions` with `signal` and `timeoutMs`.
- Wired React Query cancellation signals into read-heavy hot paths.
- Added focused API client tests.
- Screenshot evidence: `screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png`.

## Batch 3 Completed

- Added `dashboard/summary` aggregate API for Dashboard recent orders plus stats.
- Kept old list/stat endpoints intact.
- Added partial-failure fallback inside the aggregate route.
- Dashboard now uses one aggregate business query.
- Screenshot evidence: `screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png`.

## Batch 4 Completed

- Added `inventory/summary` aggregate API for filtered inventory list plus global stats.
- Kept old inventory list/page/stats endpoints intact.
- Added repository-level summary logic so list and stats reuse one inventory read.
- Inventory now uses one aggregate business query.
- Screenshot evidence: `screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png`.

## Batch 5 Completed

- Added `orders/queue-summary` aggregate API for order queue list, workflow, and options.
- Kept old order list/workflow/options endpoints intact.
- Added partial fallback for workflow/options so the list remains available if supporting reads fail.
- Orders list now uses one aggregate business query.
- Screenshot evidence: `screenshots/TASK-20260701-007-performance-optimization/orders-queue-summary-1440.png`.

Verification passed:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- non-sandbox `npm run build`
- `repairdesk-smoke.spec.ts`
- `visual-overflow.spec.ts`
- `src/lib/repairdesk/api.test.ts`
- Dashboard summary local API verification and request monitoring.
- Inventory summary local API verification and request monitoring.
- Orders queue summary local API verification and request monitoring.

## Recommended Next Batch

1. Customer/settings/message hot-path request review.
2. Small component splits for oversized screens.
3. Only after owner approval: database index/migration review or new monitoring dependency.

## Guardrails

- Stay scoped in the dirty worktree.
- Do not edit production secrets or `.env.local`.
- Do not add dependencies without approval.
- Do not add database migrations without data-migration review and owner approval.
- Do not change permission/payment/customer-message behavior as part of performance cleanup.
