# Evidence

## Baseline

- Worktree: `/private/tmp/repairdesk-imei-iphone-scanner`
- Base: `origin/main` at `d150c70a`
- Main checkout contains unrelated kiosk work and must not be included in this task.

## External / Dependency Checks

- `npm view tesseract.js version license dependencies --json`: version `7.0.0`, license `Apache-2.0`.
- `npm audit --omit=dev --json`: production vulnerabilities are existing `next` / nested `postcss` moderate advisories; no `tesseract.js` production vulnerability was reported.
- Local environment warning: current shell Node is `v20.20.2`; project requires `>=22.12.0`.

## Validation Commands

- `npm run test -- src/components/imei-scanner-field.test.tsx` -> passed, 20 tests.
- `npm run typecheck` -> passed.
- `npm run lint` -> passed.
- `npm run test` -> passed, 94 files / 626 tests.
- `npm run build` -> first sandbox run failed because Turbopack could not bind a local port; authorized rerun passed.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/imei-capture-ui.spec.ts` -> passed twice, 1 Chromium UI test.

## Visual Evidence

- `screenshots/TASK-20260709-009-imei-iphone-scanner/imei-new-order-camera-fallback-desktop.png`
- `screenshots/TASK-20260709-009-imei-iphone-scanner/imei-new-order-upload-candidates-desktop.png`

## Quality Gate

Conditional PASS for local automation:

- Passed focused scanner tests, full unit/integration suite, typecheck, lint, build, and related Playwright UI flow.
- Real iPhone Chrome/Safari physical camera behavior still needs production-device smoke testing after deploy because local Playwright cannot emulate iOS hardware focus/zoom behavior.
