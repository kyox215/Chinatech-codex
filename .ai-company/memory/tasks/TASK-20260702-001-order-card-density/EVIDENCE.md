# Evidence

## Validation

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test -- src/features/orders` passed: 17 files / 88 tests.
- `npm run test` passed: 42 files / 252 tests.
- `npm run build` first failed inside sandbox because Turbopack could not bind a local port; rerun with approved non-sandbox permissions passed.

## Visual Evidence

- `screenshots/TASK-20260702-001-order-card-density/desktop-1440-viewport.png`
- `screenshots/TASK-20260702-001-order-card-density/desktop-1024-viewport.png`
- `screenshots/TASK-20260702-001-order-card-density/desktop-1440.png`
- `screenshots/TASK-20260702-001-order-card-density/desktop-1024.png`
- `screenshots/TASK-20260702-001-order-card-density/mobile-390.png`

## Browser Checks

- `/orders` at 1440px: no horizontal overflow, desktop rows visible, inline advance buttons count 0.
- `/orders` at 1024px: no horizontal overflow, desktop rows visible, inline advance buttons count 0.
- `/orders` at 390px: no horizontal overflow; mobile list regression screenshot captured.
