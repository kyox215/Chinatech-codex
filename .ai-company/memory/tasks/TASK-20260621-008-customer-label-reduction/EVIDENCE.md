# Evidence

## Changed Files

- `src/features/customers/components/customer-list-items.tsx`
- `src/features/customers/components/customer-profile-blocks.tsx`
- `src/features/customers/screens/customer-list-screen.tsx`

## Visual Evidence

- `screenshots/customer-label-reduction-20260621/customers-desktop-label-reduced.png`
- `screenshots/customer-label-reduction-20260621/customers-mobile-label-reduced.png`
- `screenshots/customer-label-position-20260621/customers-desktop-fixed-tag-slot.png`
- `screenshots/customer-label-position-20260621/customers-mobile-390-fixed-tag-slot.png`
- `screenshots/customer-label-position-20260621/customers-mobile-320-fixed-tag-slot.png`

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx vitest run src/features/customers`: 2 files passed, 15 tests passed.
- `npm run test`: 39 files passed, 235 tests passed.
- `npm run build`: passed outside sandbox; sandbox Turbopack can hit the known internal port-binding restriction.
- Playwright DOM assertions during screenshot capture:
  - Desktop `/customers` has no `标签` column header.
  - Mobile `/customers` has no exact `普通` tag text.
  - Desktop first visible customer rows keep the compact tag slot from overlapping the customer name.
  - Mobile 390px and 320px layouts keep tag chips from covering customer names; <=360px may move the tag below the name.

## Notes

E2E auth bypass was used only for local mock-data screenshots. No real credentials or production customer data were used.
