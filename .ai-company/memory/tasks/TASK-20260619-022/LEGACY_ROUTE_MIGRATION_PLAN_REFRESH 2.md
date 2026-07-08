# Legacy Route Migration Plan Refresh

- Task: `TASK-20260619-022`
- Status: planning refreshed; code migration not performed
- Owner: Architecture + Documentation / Integration Lead
- Date: 2026-06-19 CEST

## Scope

This task refreshes the legacy route migration plan from current repository facts.
It does not change business code, delete route files, change dependencies, stage,
commit, push, deploy, or touch production data.

## Current Verified Facts

Active App Router pages live under `src/app/`, including:

- `src/app/page.tsx`
- `src/app/orders/page.tsx`
- `src/app/orders/[id]/page.tsx`
- `src/app/orders/[id]/task/page.tsx`
- `src/app/orders/new/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/buyback/page.tsx`
- `src/app/messages/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/customers/page.tsx`
- `src/app/customers/[id]/page.tsx`
- `src/app/platform/page.tsx`

Legacy route files still present under `src/routes/`:

- `src/routes/orders.tsx`
- `src/routes/messages.tsx`
- `src/routes/orders.index.tsx`
- `src/routes/inventory.tsx`
- `src/routes/index.tsx`
- `src/routes/settings.tsx`

Current live `@/routes` import found by repository scan:

- `src/features/orders/screens/order-list-screen.tsx` imports `@/routes/orders.index`.

No current active-source scan result shows the dashboard importing `@/routes/index`.
Older notes that implied dashboard still wraps a legacy route should be treated as
stale unless reverified.

## Classification

| File | Current classification | Reason | Next action |
|---|---|---|---|
| `src/routes/orders.index.tsx` | live legacy dependency | imported by `src/features/orders/screens/order-list-screen.tsx` | migrate first in a code task |
| `src/routes/orders.tsx` | legacy candidate | no live `@/routes` import found in this scan | verify after order-list migration |
| `src/routes/index.tsx` | legacy candidate | no live `@/routes` import found; dashboard claim not verified current | verify after order-list migration |
| `src/routes/inventory.tsx` | legacy candidate | no live `@/routes` import found in this scan | verify before deletion |
| `src/routes/messages.tsx` | legacy candidate | no live `@/routes` import found in this scan | verify before deletion |
| `src/routes/settings.tsx` | legacy candidate | no live `@/routes` import found in this scan | verify before deletion |

## Migration Plan

1. Start a separate implementation task for the order list.
2. Move or rebuild the order-list behavior from `src/routes/orders.index.tsx`
   into `src/features/orders/screens/order-list-screen.tsx` and supporting
   modules under `src/features/orders`.
3. Remove the `@/routes/orders.index` dependency from
   `src/features/orders/screens/order-list-screen.tsx`.
4. Run the implementation gates: `rg -n 'from "@/routes|@/routes' src`,
   `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
5. Only after the source scan has zero live `@/routes` imports and full code gates
   pass, classify the remaining `src/routes/*` files for deletion in a separate
   cleanup task.

## Risk and Conflict State

- `CONFLICT-20260619-004` remains open until the order-list import is removed.
- `ARCH-BACKLOG-20260619-001` is planning-refreshed, not implemented.
- Do not copy legacy `src/routes/*` as a pattern for new pages.
- Do not delete any legacy route file in a planning-only task.

## Evidence Summary

- `rg --files src/routes` found six legacy route files.
- `rg -n 'from "@/routes|...|@/routes' src ...` found one active source import:
  `src/features/orders/screens/order-list-screen.tsx:1`.
- `src/features/orders/screens/order-list-screen.tsx` is a thin wrapper over
  `@/routes/orders.index` at the time of this task.
