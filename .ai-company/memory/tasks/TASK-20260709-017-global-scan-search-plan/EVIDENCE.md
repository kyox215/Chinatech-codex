# Evidence

## Current Evidence

| id | evidence |
|---|---|
| E-001 | `npm run test -- src/features/capture/model/barcode-parser.test.ts src/features/capture/model/scan-search-resolver.test.ts` passed: 2 files, 24 tests. |
| E-002 | `npm run typecheck` passed after installing lockfile dependencies in the isolated worktree. |
| E-003 | `npm run lint` passed. |
| E-004 | `docs/SCAN_SEARCH_PAYLOADS.md` documents supported payloads and approval boundaries. |
| E-005 | Database review: no schema, migration, index, RLS, or data backfill changes are part of this implementation. |
| E-006 | `npm run test` passed: 99 files, 660 tests. |
| E-007 | `npm run build` passed in non-sandbox mode. Initial sandbox build failed because Turbopack could not bind a port. |
| E-008 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/orders-mobile.png`. |
| E-009 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/customers-mobile.png`. |
| E-010 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/buyback-mobile.png`. |
| E-011 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/inventory-mobile.png`. |
| E-012 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/orders-desktop.png`. |
| E-013 | Visual evidence: `screenshots/TASK-20260709-017-global-scan-search-plan/orders-scan-sheet-mobile.png`. |

## Environment Notes

- Isolated worktree: `/private/tmp/repairdesk-global-scan-search`.
- Branch: `codex/global-scan-search`.
- Base: `origin/main` at `9462f983`.
- `npm install` was run because the isolated worktree had no `node_modules` and the existing dependency tree was missing `tesseract.js`.
- npm reported Node `v20.20.2` while package metadata requires `>=22.12.0`; verification commands that have run so far still passed.
- `2026-07-09T20:43:18Z` `76ae7f4966` — npm run lint passed
- `2026-07-09T20:43:18Z` `aa8d4ec54e` — npm run typecheck passed
- `2026-07-09T20:43:18Z` `3bc7fccbb3` — npm run test passed: 99 files / 660 tests
- `2026-07-09T20:43:18Z` `bc27dcb957` — npm run build passed
- `2026-07-09T20:43:18Z` `5521e27560` — screenshots/TASK-20260709-017-global-scan-search-plan/orders-scan-sheet-mobile.png
- `2026-07-09T20:49:07Z` `caab80b9ad` — git diff --check origin/main...HEAD passed; npm run lint passed; npm run typecheck passed; npm run test passed 99 files / 664 tests; npm run build passed with elevated Turbopack permissions.
