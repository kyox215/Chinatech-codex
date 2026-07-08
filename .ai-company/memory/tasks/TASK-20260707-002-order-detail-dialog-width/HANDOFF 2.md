# Handoff

## Current State
- Desktop order detail dialogs now scale wider on larger monitors while staying inside viewport bounds.
- `/orders` detail dialog no longer forces a local 1000px maximum width.
- Mock/E2E local preview now exposes ChinaTech as active store when running through the mock source.
- Local preview is running at `http://localhost:3012`.

## If Resuming
- Start by checking `git diff -- src/lib/ui-patterns.ts src/lib/component-patterns.ts src/features/orders/screens/order-list-screen.tsx src/server/api/repairdesk-router.ts tests/e2e/order-desktop-ui-audit.spec.ts`.
- Reuse `localhost` for local Playwright verification unless the request-origin guard is also adjusted for `127.0.0.1`.
- Do not stage unrelated dirty worktree files unless the owner explicitly asks.

## Validation Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `REPAIRDESK_E2E_ORDER_AUDIT=1 PLAYWRIGHT_BASE_URL=http://localhost:3012 npx playwright test tests/e2e/order-desktop-ui-audit.spec.ts --workers=1`
- `PLAYWRIGHT_BASE_URL=http://localhost:3012 npx playwright test tests/e2e/visual-overflow.spec.ts --workers=1`
