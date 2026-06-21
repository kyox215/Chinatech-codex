# Evidence

## 2026-06-21T00:57:33+02:00

### Verification

- `npx prettier --write src/features/orders/forms/new-order-quotation-section.tsx src/features/orders/components/order-list-desktop-row.tsx src/features/orders/components/order-list-filters.tsx src/features/orders/forms/notify-dialog.tsx src/features/orders/forms/approval-request-dialog.tsx src/features/orders/forms/payment-dialog.tsx src/features/orders/forms/cancel-dialog.tsx`: passed.
- `git diff --check -- src/features/orders/forms/new-order-quotation-section.tsx src/features/orders/components/order-list-desktop-row.tsx src/features/orders/components/order-list-filters.tsx src/features/orders/forms/notify-dialog.tsx src/features/orders/forms/approval-request-dialog.tsx src/features/orders/forms/payment-dialog.tsx src/features/orders/forms/cancel-dialog.tsx`: passed.
- `npm run typecheck`: passed.
- `npm run test -- src/features/orders`: 15 files passed, 78 tests passed.
- `npm run lint`: passed.
- `npm run build`: sandbox run failed with known Turbopack process/port permission issue; non-sandbox rerun passed.

### Visual Evidence

- `screenshots/figma-ui-system-20260620/orders-new-dense-desktop.png`
- `screenshots/figma-ui-system-20260620/orders-new-dense-mobile.png`
- `screenshots/figma-ui-system-20260620/orders-new-quote-summary-mobile.png`
- `screenshots/figma-ui-system-20260620/orders-desktop-queue-actions.png`
- `screenshots/figma-ui-system-20260620/order-payment-dialog-compact-desktop.png`
- `screenshots/figma-ui-system-20260620/order-notify-dialog-compact-desktop.png`
- `screenshots/figma-ui-system-20260620/order-cancel-dialog-compact-desktop.png`

### Browser Metrics

- Desktop validation viewport: `1440x1000`; `innerWidth=1440`, `scrollWidth=1440`, `bodyScrollWidth=1440`.
- Mobile validation viewport: `390x844`; `innerWidth=390`, `scrollWidth=390`, `bodyScrollWidth=390`.
- Local preview port `3027` was stopped after screenshots; no listener remained.

### Protected Scope

- Did not edit `src/features/orders/screens/order-detail-screen.tsx`.
- Did not edit `src/features/orders/screens/order-task-screen.tsx`.
- Did not edit `src/features/orders/components/order-list-mobile-header.tsx`.
- Did not change mobile order-management list rendering.
