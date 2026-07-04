# Evidence

## Screenshots

- `screenshots/TASK-20260704-004-order-mobile-filter-touch-sort/orders-mobile-sorted-393.png`
  - Mobile `/orders` list at 393 x 852.
  - Shows rectangular process filters, enlarged header controls, compact cards, and 1/5 cards first.
- `screenshots/TASK-20260704-004-order-mobile-filter-touch-sort/orders-mobile-filter-sheet-touch-393.png`
  - Mobile filter sheet top at 393 x 852.
  - Shows 40px close button and 40px filter buttons.
- `screenshots/TASK-20260704-004-order-mobile-filter-touch-sort/orders-mobile-filter-sheet-bottom-iab-393.png`
  - Mobile filter sheet scrolled to technician and external supplier rows.
  - Shows 44px label rows and 44px fixed apply/reset bar.

## Browser Verification

- Viewport: 393 x 852.
- List:
  - `document.documentElement.scrollWidth = 393`
  - `window.innerWidth = 393`
  - `hasHorizontalOverflow = false`
  - visible progress sequence was nondecreasing:
    `1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5`
- Mobile header:
  - menu button: 40 x 40
  - create button: 40 x 40
  - filter button: 40 x 40
- Filter sheet:
  - close button: 40 x 40
  - visible filter chips: 40px high
  - technician and supplier label rows: 44px high
  - reset button: 44px high
  - apply button: 44px high

## Commands

```bash
git diff --check -- src/components/ui/sheet.tsx src/features/orders/components/order-list-mobile-header.tsx src/features/orders/components/order-list-filters.tsx src/features/orders/server/order.repository.ts src/features/orders/testing/mock-api.ts src/features/orders/testing/mock-api.test.ts
npm run lint
npm run typecheck
npm run test -- src/features/orders/testing/mock-api.test.ts src/features/orders/model/order-task-flow.test.ts src/features/orders/model/canonical-order-status.test.ts
npm run test
npm run build
```

## Results

- `git diff --check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- targeted tests: 3 files passed, 46 tests passed.
- full tests: 43 files passed, 260 tests passed.
- first sandboxed `npm run build`: failed due Turbopack sandbox port binding permission.
- escalated `npm run build`: passed.
- `2026-07-04T16:30:53Z` `0ac012a146` — lint,typecheck,full tests,build,browser 393px screenshots
- `2026-07-04T16:32:33Z` `0460ddb822` — git push origin main e93f47a
