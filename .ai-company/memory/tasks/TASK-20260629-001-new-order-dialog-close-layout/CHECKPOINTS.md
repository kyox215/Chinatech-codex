# Checkpoints

## 2026-06-30T00:15:00+02:00 - Closed

Implemented the approved new order dialog layout plan.

Completed:

- Disabled the default Radix Dialog close button for the active App Router new order dialog.
- Added explicit dialog close controls inside `NewOrderScreen`: desktop close inside the top work card and mobile-dialog close inside a compact dialog header.
- Removed right-side form padding that previously compensated for the floating default close button.
- Added E2E assertions for visible close control, header/grid/submit alignment, and close button containment.
- Generated visual evidence screenshots.

Validation:

- Static, unit, production build, focused desktop E2E, business overflow E2E, and visual overflow checks passed.
- Exact `npm run test:e2e:desktop` command was attempted but failed because the default fully-parallel run exceeded 30s in unrelated broad flows; rerunning the same spec set single-worker with extended timeout passed.

Next:

- If the owner wants misclose protection later, implement a separate unsaved-change confirmation flow with explicit acceptance criteria.
