# Order List Migration Implementation Report

- Task: `TASK-20260619-025`
- Date: 2026-06-19
- Owner: Integration Lead / CEO Agent
- Autonomy: L2 controlled execution
- Status: implemented; ready for closeout

## Summary

The active order list screen no longer imports the legacy `@/routes/orders.index`
wrapper. The order-list behavior was moved into feature-owned files under
`src/features/orders/`, and the active source scan now reports no `@/routes`
imports under `src`.

## Files changed by this task

- `src/features/orders/screens/order-list-screen.tsx`
- `src/features/orders/components/order-list-filters.tsx`
- `src/features/orders/components/order-list-desktop-row.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`
- `src/features/orders/components/order-list-states.tsx`
- `src/features/orders/model/order-list-export.ts`
- `src/features/orders/model/order-list-export.test.ts`
- `src/features/orders/api/query-keys.ts`

## Behavior preservation map

| Behavior | New owner |
|---|---|
| Search, workflow filters, active chips, filter sheet | `order-list-screen.tsx`; `order-list-filters.tsx`; `order-list-mobile-header.tsx` |
| Desktop order queue row and detail dialog entry | `order-list-desktop-row.tsx`; `order-list-screen.tsx` |
| Mobile cards and floating header | `order-list-screen.tsx`; `order-list-mobile-header.tsx`; existing `OrderMobileCard` |
| New order dialog | `order-list-screen.tsx`; existing `NewOrderScreen` |
| Single and bulk transitions | `order-list-screen.tsx` |
| Print sheet | `order-list-screen.tsx`; existing `OrderListPrintSheet` |
| CSV export | `order-list-export.ts`; `order-list-screen.tsx` |
| Loading, empty, error, pagination states | `order-list-states.tsx`; `order-list-screen.tsx` |
| Order-list query keys | `query-keys.ts`; `order-list-screen.tsx` |

## Validation

| Gate | Result |
|---|---|
| `rg -n 'from "@/routes|@/routes' src` | no matches |
| `npx prettier --check ...` | passed |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run test` | passed, 38 files / 225 tests |
| sandbox `npm run build` | failed with known Turbopack port-binding environment error |
| non-sandbox `npm run build` | passed |
| `npm run agents:check` after memory/docs sync | passed |
| final current dirty-workspace rerun | lint, typecheck, test, agents check, and non-sandbox build passed; tests now 38 files / 226 tests |

## Constraints honored

- Did not delete or edit `src/routes/*`.
- Did not stage, commit, push, deploy, or publish.
- Did not change dependencies.
- Did not change API/server contracts, Supabase migrations, production data,
  payment rules, permission rules, tenant rules, or customer communication.

## Residual risk and follow-up

- `src/routes/*` legacy files still exist and should be classified/deleted only
  through a separate cleanup task after owner authorization.
- `src/features/orders/screens/order-list-screen.tsx` is still a large container.
  It is no longer a legacy wrapper, but further decomposition remains a useful
  architecture backlog item.
- Browser/manual UI exercise was not run in this task. The migration is covered
  by source movement, query-key cleanup, unit coverage for export, and full local
  code gates.

## Rollback note

Rollback is local and file-scoped: restore the active order-list wrapper import
and remove the newly extracted feature files if a regression is found before
commit. No data, dependency, production, or deploy state was changed.
