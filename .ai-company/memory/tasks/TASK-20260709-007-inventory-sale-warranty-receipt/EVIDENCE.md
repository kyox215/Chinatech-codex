# Evidence

## Startup Evidence

- Root AGENTS.md read.
- AI Company OS adoption and policies read.
- RepairDesk department design read.
- Architecture, UI page, component, responsive, and mobile detail standards read.
- Supabase skill read from plugin cache.
- Supabase changelog web lookup attempted but no result was available in current search response; no production schema execution will be performed.
- Initial `git status --short` was clean.

## Implementation Evidence

- `src/features/inventory/model/inventory-sale-receipt.ts` added sale receipt snapshot, printable receipt data, and warranty state helpers.
- `src/features/inventory/server/inventory.repository.ts` now supports direct inventory sources, compatible initial status, warranty months on create, and sale receipt snapshot persistence on sell.
- `src/features/inventory/testing/mock-api.ts` mirrors direct-stock creation and sale receipt snapshot behavior.
- `src/features/inventory/screens/inventory-screen.tsx` now exposes "新增库存商品", direct source/status/cost/warranty fields, sale summary, and sold-item warranty receipt preview/print action.
- `src/lib/repairdesk/types.ts` and `src/server/api/repairdesk-schemas.ts` now accept source/initial status/warranty fields and warranty terms snapshot.
- `src/features/inventory/model/inventory-sale-receipt.test.ts` and `src/features/inventory/testing/mock-api.test.ts` cover receipt and direct stock sale behavior.

## Validation Evidence

- `npm run test -- --run src/features/inventory/model/inventory-sale-receipt.test.ts src/features/inventory/testing/mock-api.test.ts` passed: 2 files, 9 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 92 files, 621 tests.
- `npm run build` first failed inside sandbox due Turbopack `binding to a port` EPERM; rerun outside sandbox passed.
- `git diff --check` passed.

## Visual Evidence

- Screenshot not captured. Browser plugin reported no available in-app browser backends.
- Dev server inside sandbox failed with `listen EPERM: operation not permitted 0.0.0.0:3000`.
- An outside dev process was reported by Next on `localhost:3012`, but sandbox `curl` could not connect to that process.
- Build output listed `/inventory`, confirming the route compiles.

## Worktree Scope Evidence

- Worktree contains unrelated kiosk/settings/API changes and `TASK-20260709-008-kiosk-staff-review`; they must not be staged with this inventory task.
- `src/lib/repairdesk/types.ts` and `src/server/api/repairdesk-schemas.ts` contain both inventory hunks and unrelated kiosk hunks; stage only inventory hunks.
