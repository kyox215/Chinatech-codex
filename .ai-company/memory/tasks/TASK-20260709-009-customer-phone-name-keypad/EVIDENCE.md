# Evidence

## Validation Results

- PASS: `npm run test -- src/shared/lib/mobile-input.test.ts src/components/orders/phone-keypad-input.test.tsx src/components/orders/money-keypad-input.test.tsx` (3 files, 7 tests).
- PASS: `npm run lint`.
- PASS: `npm run typecheck`.
- PASS: `npm run test` (94 files, 625 tests).
- PASS: `npm run build` with approved local process permissions.
- PASS: Playwright mobile E2E for `tests/e2e/mobile-input-keyboard.spec.ts`.

## Browser Evidence

Page:
- `/orders/new`

Mobile viewport:
- 390 x 844

Verification flow:
- Confirmed customer phone section has no native `inputmode="tel"` field.
- Opened phone virtual keypad.
- Entered `+39333` through app keypad.
- Confirmed phone realtime result panel is visible.
- Confirmed name field rejects numeric search with the message `姓名搜索只接收姓名，电话号码请在电话栏输入`.
- Confirmed IMEI field still uses native numeric input.
- Confirmed amount fields still use the app money keypad.

Screenshots:
- `screenshots/TASK-20260709-009-customer-phone-name-keypad/phone-keypad-chromium.png`
- `screenshots/TASK-20260709-009-customer-phone-name-keypad/new-order-customer-phone-results-chromium.png`
- `screenshots/TASK-20260709-009-customer-phone-name-keypad/money-keypad-chromium.png`
- `screenshots/TASK-20260709-009-customer-phone-name-keypad/new-order-money-keypad-fields-chromium.png`

## Environment Notes

- The isolated worktree initially used a `node_modules` symlink for quick checks; Turbopack build rejected the symlink. A real ignored `node_modules` copy was used for final build/E2E validation.
- Sandboxed `npm run build` fails with Turbopack `Operation not permitted` during process/port binding; the same build passed after approved sandbox escalation.
