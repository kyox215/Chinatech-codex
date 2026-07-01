# Handoff

## Current State

The order phone password / unlock method feature is implemented and validated locally. Production database migration is prepared but unapplied.

## Key Files

- `src/features/orders/model/device-unlock.ts`
- `src/features/orders/components/device-unlock-fields.tsx`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/testing/mock-api.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/server/repairdesk-shared.ts`
- `src/lib/repairdesk/types.ts`
- `supabase/migrations/20260701120000_order_device_unlock_credentials.sql`

## Verification

Use:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

For UI, run with E2E mock auth enabled and verify `/orders`, `/orders/new`, desktop detail modal, and `/orders/ord_1` mobile detail.

## Risks

- Existing production databases need the new migration before canonical columns can persist unlock data.
- The repository has many unrelated pre-existing modified/untracked files; stage only this task's files if committing.
