# Checkpoints

## 2026-06-20 01:21 CEST

Stage: verified

Completed:
- Added `order-fault-description` helper for unique source item extraction, item detection, missing item counting, and append-without-overwrite behavior.
- Added unit tests for the helper.
- Updated `FaultDescriptionEditSheet` with batch add buttons, per-item add buttons, already-added disabled states, and empty source messaging.

Verification:
- Focused helper test passed.
- `npm run lint` passed.
- `npm run typecheck` passed standalone.
- `npm run test -- src` passed.
- `npm run build` passed with sandbox elevation.
- `npx playwright test tests/e2e/visual-overflow.spec.ts` passed with sandbox elevation.

Open items:
- None for this task.

Residual risk:
- The current worktree contains unrelated uncommitted changes. Any future commit must stage only this task's intended files or explicitly include approved adjacent work.

## 2026-06-20 01:38 CEST

Stage: verified density follow-up

Completed:
- Tightened the mobile `FaultDescriptionEditSheet` header, source list, textarea section, and footer actions for one-screen high-density use.
- Added missing-item counters and compact batch/single add controls in the Sheet header/source list.
- Centered the bottom Sheet and gave desktop/tablet widths a larger two-column editor.
- Changed desktop order overview issue/diagnosis display to a responsive two-column grid on wider surfaces, keeping warranty full-width below.

Verification:
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test -- src/features/orders/model/order-fault-description.test.ts` passed.
- `npm run test -- src` passed.
- `npm run build` passed with sandbox elevation after ordinary sandbox port-binding failure.
- `npx playwright test tests/e2e/visual-overflow.spec.ts` passed with sandbox elevation after ordinary sandbox dev-server failure.
- Screenshots captured with E2E auth bypass:
  - `/private/tmp/repairdesk-desktop-density-detail.png`
  - `/private/tmp/repairdesk-mobile-fault-description-density.png`

Open items:
- None for this density follow-up.
