# Evidence

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run test -- src/shared/lib/mobile-input.test.ts src/components/imei-scanner-field.test.tsx` passed: 2 files, 21 tests.
- `npm run test` passed: 89 files, 611 tests.
- `npm run build` passed after rerunning outside the sandbox. The first sandboxed attempt failed because Turbopack could not bind a local port with `Operation not permitted`.
- `REPAIRDESK_E2E_ORDER_AUDIT=1 ... npx playwright test tests/e2e/mobile-input-keyboard.spec.ts` passed: 1 test.

## Visual Evidence

- `screenshots/TASK-20260709-005-mobile-numeric-keyboards/new-order-mobile-keyboard-fields-chromium.png`

## Notes

- Playwright screenshots cannot show the native iOS/Android keyboard. The E2E test instead asserts the actual input attributes: phone uses `inputmode="tel"`, IMEI uses `inputmode="numeric"`, and money uses `inputmode="decimal"`.
