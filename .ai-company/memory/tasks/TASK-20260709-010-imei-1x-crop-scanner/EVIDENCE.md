# Evidence

## Baseline

- Worktree: `/private/tmp/repairdesk-imei-iphone-scanner`
- Base: `origin/main` at `2b94ca55`

## Validation Commands

- `npm run test -- src/components/imei-scanner-field.test.tsx` -> passed, 20 tests.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run test` -> passed, 94 files / 626 tests.
- `npm run build` -> first sandbox run failed because Turbopack could not bind a local port; authorized rerun passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts` -> passed, 1 Chromium UI test.

## Visual Evidence

- `screenshots/TASK-20260709-010-imei-1x-crop-scanner/imei-new-order-camera-fallback-desktop.png`
- `screenshots/TASK-20260709-010-imei-1x-crop-scanner/imei-new-order-upload-candidates-desktop.png`

## Quality Gate

Conditional PASS:

- Automated verification passed.
- Real iPhone Chrome/Safari hardware smoke test remains recommended because Playwright cannot reproduce physical autofocus and lens behavior.
