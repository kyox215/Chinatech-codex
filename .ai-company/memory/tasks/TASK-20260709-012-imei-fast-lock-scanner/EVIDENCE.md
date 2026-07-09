# Evidence

## Baseline

- Worktree: `/private/tmp/repairdesk-imei-iphone-scanner`
- Base: `origin/main` at `a02d1bac`

## Validation Commands

- `npm run test -- src/components/imei-scanner-field.test.tsx`
  - Result: passed, 1 file / 21 tests.
- `npm run typecheck`
  - Result: passed.
- `npm run lint`
  - Result: passed.
- `npm run test`
  - Result: passed, 94 files / 627 tests.
- `npm run build`
  - Result: sandbox run failed with Turbopack port-binding permission error.
  - Follow-up: rerun outside sandbox with the same command passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts`
  - Result: passed, 1 Chromium smoke test.

## Visual Evidence

- `/private/tmp/repairdesk-imei-iphone-scanner/screenshots/TASK-20260709-012-imei-fast-lock-scanner/imei-new-order-camera-fallback-desktop.png`
- `/private/tmp/repairdesk-imei-iphone-scanner/screenshots/TASK-20260709-012-imei-fast-lock-scanner/imei-new-order-upload-candidates-desktop.png`

## Notes

- The Playwright run rewrote screenshots under the prior task directory and `next-env.d.ts`; those generated changes were restored after copying the current evidence into this task directory.
