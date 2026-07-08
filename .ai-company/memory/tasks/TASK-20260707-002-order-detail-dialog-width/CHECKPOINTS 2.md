# Checkpoints

## 2026-07-07 14:06 CEST
- Implemented responsive desktop detail dialog width staircase:
  - small desktop: `min(1120px, 100vw - 48px)`
  - xl: `min(1320px, 100vw - 64px)`
  - 2xl: `min(1560px, 100vw - 96px)`
- Removed the `/orders` local `1000px` detail dialog override so it inherits the shared surface width.
- Added E2E min-width expectations that follow the new breakpoint behavior.
- Added mock/E2E onboarding fallback to return the mock ChinaTech store when the bypass/system actor has no store id, allowing local preview and E2E pages to enter the business workspace.
- Current preview server: `http://localhost:3012`.

## Known Follow-Up
- `npm run test:e2e:desktop` package script still uses `127.0.0.1:3011`; in this environment that address triggers the request-origin guard for POST APIs. `localhost:3012` works.
- The equivalent `localhost` desktop suite passes order audit but the generic business dialog test still fails in the customer-detail portion on `客户工单标签`; this is outside the order detail width scope.
