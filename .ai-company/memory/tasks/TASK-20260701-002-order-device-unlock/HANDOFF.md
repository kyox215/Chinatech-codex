# Handoff

## Current State

The order phone password / unlock method feature is implemented, pushed, and the production Supabase migration has been applied to project `xluzcoduqsdvjoouqhkc`.

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

Production migration verification already completed:

- Migration history: `20260701214123 order_device_unlock_credentials`
- Columns: `device_unlock_method`, `device_unlock_value`, `device_unlock_pattern`
- Constraints: `repair_orders_device_unlock_method_check`, `repair_orders_device_unlock_shape_check`
- Function: `public.repairdesk_valid_unlock_pattern(integer[])`

## Risks

- Other environments or branches still need the migration if they are not linked to production `xluzcoduqsdvjoouqhkc`.
- The repository has many unrelated pre-existing modified/untracked files; stage only this task's files if committing.
