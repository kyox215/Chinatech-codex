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

## Production Migration Applied

Applied: 2026-07-01T23:43:58+02:00
Approved by: Owner direct instruction, "应用migration"
Target project: `ChinaTech_date` / `xluzcoduqsdvjoouqhkc`
Applied migration history entry: `20260701214123 order_device_unlock_credentials`

Verification:
- Before apply, `repair_orders` did not contain `device_unlock_method`, `device_unlock_value`, or `device_unlock_pattern`.
- After apply, all three columns exist and are nullable.
- Constraint `repair_orders_device_unlock_method_check` exists.
- Constraint `repair_orders_device_unlock_shape_check` exists.
- Function `public.repairdesk_valid_unlock_pattern(integer[])` exists, returns boolean, and is immutable.
- Transaction-only valid PIN update succeeded and was rolled back.
- Invalid PIN update was rejected by the database check constraint.
- Pattern validator returned true for a 4-point valid pattern and false for duplicate/too-short patterns.
- Post-rollback production counts for unlock fields remained zero, confirming no test unlock data was left behind.

Advisor note:
- `supabase db advisors --linked` could not run from local CLI because no Supabase access token is present in this environment.
- MCP SQL verification was used instead for this migration's concrete schema and constraint checks.

Screenshots:
- No related task page screenshot was captured for the migration application itself because this was a backend/database operation. Replacement evidence is the migration history entry and SQL verification above.
