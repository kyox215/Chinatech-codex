# Evidence

## Baseline

- Branch: `codex/imei-overlay-binding`
- Worktree: `/private/tmp/repairdesk-imei-overlay-binding`
- Base: `origin/main`
- Current finding: `findDetectionForCandidate` falls back to `detections[fallbackIndex]` when direct candidate matching fails, which can attach a wrong box to OCR-only candidates.

## Validation Log

- `npm run test -- src/components/imei-scanner-field.test.tsx src/features/capture/model/barcode-parser.test.ts` — passed, 2 files / 41 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed after Prettier formatting fix.
- `npm run test` — passed, 95 files / 633 tests.
- `npm run build` — first sandbox run failed on Turbopack local port binding; rerun outside sandbox passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts` — passed, 1 Chromium UI test.

## Visual Evidence

- `screenshots/TASK-20260709-014-imei-overlay-value-binding/imei-new-order-camera-fallback-desktop.png`
- `screenshots/TASK-20260709-014-imei-overlay-value-binding/imei-new-order-upload-candidates-desktop.png`
