# Evidence

## Repo Evidence

- `src/features/orders/components/repair-order-print-sheet.tsx`: printed repair sheet already renders a QR code for an internal task URL.
- `src/features/orders/components/order-overview-tab.tsx`: order overview already contains a customer signature section placeholder.
- `src/lib/repairdesk/types.ts`: `RepairOrder` includes `customer_signature`; order attachment kinds include `signature`.
- `src/server/api/repairdesk-schemas.ts`: order attachment schema includes `signature` and validates attachment mime types.
- `src/features/orders/server/order.repository.ts`: order attachment server constants include `signature`.
- `src/features/realtime/model/realtime-events.ts`: realtime events are store-scoped and reject sensitive keys such as customer, phone, imei, order id, signed URL, and signature-related payload.
- `src/features/stores/server/store-provisioning.ts`: default order workflow includes pickup/completion transitions including `waiting_pickup`, `unfixed_pickup`, and `completed`.

## Memory Evidence Used

- `MEMORY.md` customer workbench and order workflow entries confirmed that customer/order changes must ship model, UI, tests, permissions, and store-scoped cache/contracts together.

## Validation

- `npm run lint` passed on 2026-07-09.
- `npm run typecheck` passed on 2026-07-09.
- `npm run test -- src/features/kiosk/model/kiosk-session.test.ts` passed: 1 file, 4 tests.
- `npm run test` passed: 88 files, 608 tests.
- `npm run build` passed after running outside sandbox because Turbopack needs local port/process privileges.
- Visual evidence captured from production local server `http://127.0.0.1:3013/kiosk`:
  - `screenshots/TASK-20260709-004-customer-kiosk-ipad-plan/kiosk-mobile-pairing.png`
  - `screenshots/TASK-20260709-004-customer-kiosk-ipad-plan/kiosk-desktop-pairing.png`

## Implementation Evidence

- `src/features/kiosk/`: kiosk session normalization, tests, public screen, mock API, server repository/service.
- `src/app/kiosk/page.tsx`: public customer kiosk entry.
- `src/app/api/kiosk/*`: public pair/session/submit API routes.
- `src/features/settings/screens/settings-screen.tsx`: customer iPad device management section.
- `src/features/orders/screens/order-detail-screen.tsx`: order detail sends pickup confirmation to active iPad.
- `src/features/orders/screens/order-task-screen.tsx`: QR task page sends pickup confirmation to active iPad.
- `src/utils/supabase/proxy.ts`: allows `/kiosk` and `/api/kiosk/*` without staff login.
- `src/app/providers.tsx`: renders `/kiosk` without staff AppShell.
- `supabase/migrations/20260709233000_customer_kiosk_ipad_mvp.sql`: migration draft only; not applied to production in this task.
