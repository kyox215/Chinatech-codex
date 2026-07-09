# Evidence

## Validation Results

- PASS: `npm run test -- src/shared/lib/mobile-input.test.ts src/components/orders/money-keypad-input.test.tsx` (2 files, 5 tests).
- PASS: `npm run lint`.
- PASS: `npm run typecheck`.
- PASS: `npm run test` (90 files, 614 tests).
- PASS: `npm run build` with approved local process permissions.
- PASS: Playwright mobile E2E for `tests/e2e/mobile-input-keyboard.spec.ts`.

## Browser Evidence

Page:
- `/orders/new`

Mobile viewport:
- 390 x 844

Verification flow:
- Opened new order page.
- Confirmed customer phone uses `inputmode="tel"`.
- Confirmed device/IMEI field uses `inputmode="numeric"`.
- Confirmed quotation section no longer renders `inputmode="decimal"` money inputs.
- Opened the money keypad trigger.
- Tapped `1`, `2`, backspace, and clear.
- Confirmed the in-app keypad remained visible and updated the trigger value.

Screenshots:
- `screenshots/TASK-20260709-006-order-money-virtual-keypad/money-keypad-chromium.png`
- `screenshots/TASK-20260709-006-order-money-virtual-keypad/new-order-money-keypad-fields-chromium.png`

## Environment Notes

- The first sandboxed `npm run build` failed with Turbopack `Operation not permitted` while binding a port.
- The same build passed after approved sandbox escalation.

## Git Evidence

- Commit: `afcf1402 Add virtual money keypad for order amounts`.
- Push: `origin/main` updated from `2710f223` to `afcf1402`.
