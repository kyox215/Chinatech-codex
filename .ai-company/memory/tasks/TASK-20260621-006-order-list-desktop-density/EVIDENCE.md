# Evidence

## Validation

- `npx prettier --write src/features/orders/screens/order-list-screen.tsx` passed.
- `git diff --check -- src/features/orders/screens/order-list-screen.tsx` passed.
- `npm run typecheck` passed.
- `npm run test -- src/features/orders` passed: 15 files, 78 tests.
- `npm run lint` passed.
- `npm run build` failed inside the sandbox with the known Turbopack internal port-binding restriction, then passed outside the sandbox.

## Browser Evidence

Local preview:

- `REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npm run dev -- -p 3028`

Playwright screenshots:

- `screenshots/figma-ui-system-20260620/orders-desktop-queue-health-strip.png`
- `screenshots/figma-ui-system-20260620/orders-mobile-list-safe-after-health-strip.png`

Overflow and visibility metrics:

- Desktop 1440px: `scrollWidth=1440`, `bodyScrollWidth=1440`, health strip visible, 48 desktop rows.
- Mobile 390px: `scrollWidth=390`, `bodyScrollWidth=390`, health strip hidden, 48 mobile cards.

## Protected Scope Check

Current workspace status still shows pre-existing changes for:

- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/components/order-list-mobile-header.tsx`

This task only edited `src/features/orders/screens/order-list-screen.tsx` for the desktop-only health strip.
