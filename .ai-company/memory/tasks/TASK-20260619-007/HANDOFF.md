# Handoff — TASK-20260619-007

## Current state

The new order desktop dialog/page has been refactored and verified. Local preview is available at `http://localhost:3011/orders` with `REPAIRDESK_E2E_BUSINESS_DESKTOP=1` for auth bypass during verification.

## Changed files

- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/forms/new-order-fault-diagnosis-section.tsx`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/lib/ui-patterns.ts`
- `src/lib/component-patterns.ts`

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- Targeted desktop overflow E2E for business routes
- Manual Playwright layout metrics at 1024, 1280, and 1440

## Resume notes

- If the owner asks for more compact desktop behavior, start from `NewOrderQuotationSection` spacing and not from data logic.
- Do not re-enable three columns at 1024px; that caused page overflow with the app sidebar.
- Existing full desktop E2E failures in order detail audit are separate and should be handled in a dedicated task.
