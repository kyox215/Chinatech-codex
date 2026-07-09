---
schema_version: 1
task_id: "TASK-20260709-018-order-load-customer-relationship"
updated_at: "2026-07-09T15:18:30Z"
---
# Handoff

## Current State

The bug is fixed locally in `/private/tmp/repairdesk-order-load-relationship`.

## Files Changed

- `src/server/repairdesk-shared.ts`
- `src/features/orders/server/order.repository.ts`
- `src/server/repairdesk-shared.test.ts`
- `.ai-company/memory/tasks/TASK-20260709-018-order-load-customer-relationship/*`

## Verification Already Run

- `npm run test -- --run src/server/repairdesk-shared.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `git diff --check`
- `npm run build`
- Read-only production FK query with `supabase db query --linked`.

## Release Notes

No database migration is needed for this code fix. Production already has the `repair_orders_customer_same_store_fkey` relationship that the code now references.

Because a push to `main` may trigger production deployment, confirm owner approval or rely on explicit task context before pushing.

## No Screenshot Reason

This is a backend/query failure fix. No authenticated browser session is available in the local environment to safely screenshot the repaired production orders page without customer data. Alternative evidence is test/build output plus production schema query.
