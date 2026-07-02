# Evidence

## Gates

- `npm run test -- src/features/orders/model/device-unlock.test.ts src/server/api/repairdesk-schemas.test.ts src/features/orders/testing/mock-api.test.ts`: passed, 3 files / 48 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 42 files / 253 tests.
- `npm run build`: failed inside sandbox because Turbopack could not bind a local process/port (`Operation not permitted`).
- `npm run build`: passed outside sandbox after explicit escalation for the same build gate.
- Scoped `git diff --check` for touched unlock files, migration, and task memory: passed.
- Playwright mobile verification script: passed outside sandbox after Chromium launch was blocked by macOS MachPort permissions inside sandbox.

## Screenshots

- `screenshots/TASK-20260702-002-order-device-unlock-mobile-pin-pattern/orders-new-pin-390.png`
  - 390px `/orders/new`, PIN selected, input focused with `inputMode="numeric"` and `type="tel"`, value sanitized from `001258a9` to `0012589`, no horizontal overflow.
- `screenshots/TASK-20260702-002-order-device-unlock-mobile-pin-pattern/order-detail-pattern-sheet-430.png`
  - 430px mobile order detail `编辑手机密码` Sheet, pattern mode, 10-step repeated trajectory after clearing existing mock pattern, SVG polyline contains 10 points, no horizontal overflow.

## Privacy Checks

- The public `DeviceUnlockInput` shape stayed compatible.
- PIN still validates as 1-16 digits and preserves leading zeroes.
- Pattern still stores only ordered point numbers in range 1-9; repeated points are now allowed, with a defensive 128-step cap.
- List/event privacy behavior was preserved: tests still assert that list output and order events do not contain plaintext PIN or pattern sequence.
- No print, export, WhatsApp, SMS, or external message surfaces were extended with unlock secrets.

## Production Note

- Added `supabase/migrations/20260702001000_order_device_unlock_pattern_trajectory.sql`.
- The migration only replaces `public.repairdesk_valid_unlock_pattern(integer[])`; it does not add/drop columns, backfill, delete data, or apply to production.
- Any production Supabase migration application remains an owner approval point.
