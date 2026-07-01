# Evidence

## Gates

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run test -- --reporter=dot`: passed, 40 files / 243 tests.
- `npm run build`: passed outside sandbox after Turbopack sandbox port/process restriction.
- Focused privacy/schema tests passed before full gate:
  - `src/features/orders/model/device-unlock.test.ts`
  - `src/server/api/repairdesk-schemas.test.ts`
  - `src/features/orders/testing/mock-api.test.ts`

## Screenshots

All screenshot checks reported `scrollWidth - clientWidth = 0`.

- `screenshots/order-device-unlock-20260701/orders-list-desktop-unlock-summary.png`
- `screenshots/order-device-unlock-20260701/order-detail-desktop-unlock-hidden.png`
- `screenshots/order-device-unlock-20260701/order-detail-desktop-unlock-revealed.png`
- `screenshots/order-device-unlock-20260701/orders-new-pattern-editor.png`
- `screenshots/order-device-unlock-20260701/order-detail-mobile-unlock-hidden.png`
- `screenshots/order-device-unlock-20260701/order-detail-mobile-unlock-editor-sheet.png`

## Privacy Checks

- List select includes only `device_unlock_method`; detail select returns full fields.
- Mock list output deletes `device_unlock_value` and `device_unlock_pattern`.
- Audit events record only change/type metadata, not password text, PIN, or pattern sequence.
- Existing export/print/message templates were checked and not extended with unlock secrets.

## Production Note

Migration file added but not applied to production: `supabase/migrations/20260701120000_order_device_unlock_credentials.sql`. Applying it is an Owner approval point.
