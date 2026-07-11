# Evidence

## Baseline

- Branch: codex/order-detail-preload-skeleton-20260711.
- Base: origin/main@e286bbdc6d5dcab8f4a1e0e7067a55a7f0911dae.
- Original checkout remains dirty and is excluded from implementation.
- Existing Realtime/preload implementation: 96f3197d480a44385bc179d5c27bc342a7f9e186.

## Acceptance Evidence

| Acceptance | Evidence |
| --- | --- |
| Full route skeletons | Component assertions plus delayed order/customer/detail Playwright frames |
| Warm and background states | Customer warm-navigation request count and filtered-refresh old-row preservation |
| Detail request reuse | Exactly two automatic `order/get` requests; opening the first Dialog keeps the count at two |
| Bounded scheduler | Unit tests for network limits, concurrency one, queue two, latest-intent replacement, deduplication and cancellation |
| Realtime safety | Deferred detail preload is rejected after order-event group epoch changes |
| Store isolation | Deferred old-store detail preload is rejected after store epoch changes |
| Detail exit action | Component Dialog close test and 390 px cold-detail real back-link browser test |
| Responsive UI | Overflow assertions and screenshots at 390, 430, 1024 and 1440 px |
| Release | lint, typecheck, 761 tests, build, 21 controlled Playwright runs, scoped diff and remote hash |

## Verification - 2026-07-11T00:19:35Z

- Targeted post-review suites: 5 files / 24 tests passed.
- Final `npm run lint`: passed.
- Final `npm run typecheck`: passed.
- Final `npm run test`: 114 files / 761 tests passed.
- Final `npm run agents:check`: config, templates and rules passed.
- Final production build: passed; 22 routes/pages generated. The first sandboxed attempt failed only because Turbopack could not bind an internal local port; the approved non-sandbox build passed.
- Controlled Playwright: 7 scenarios repeated three times, 21/21 passed with no skipped result.
- Browser request proof: default order workspace sent exactly two detail requests; opening the first detail reused the warm request and sent no third request.
- Browser refresh proof: customer filter refresh preserved the old table, showed no cold skeleton, then replaced rows when the request completed.
- Browser layout proof: document-level overflow assertions passed at 390, 430, 1024 and 1440 px.
- `git diff --check`: passed after final generated-file cleanup.
- Independent Architecture review: PASS; single automatic owner and bounded queue verified.
- Independent UX review: PASS after recoverable shell error retry and semantic container correction.
- Independent QA review: PASS after confirming lint, typecheck, Agent checks, 114 files / 761 tests, production build, 21/21 Playwright, no skipped/flaky result, clean generated-file scope and `git diff --check`.

## Visual Evidence

- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/mobile-order-full-frame-skeleton.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/mobile-customer-full-frame-skeleton.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/mobile-order-detail-full-frame-skeleton.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/mobile-order-realtime-state.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/mobile-430-order-workspace.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/tablet-1024-customer-workspace.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/desktop-customer-warm-navigation.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/desktop-customer-background-refresh.png`
- `screenshots/TASK-20260711-002-order-detail-preload-skeleton/desktop-preloaded-order-detail.png`

## Production Boundary

- No database schema, migration, Supabase Dashboard, production Realtime flag, secret, production data or deployment operation was changed.
- `NEXT_PUBLIC_REPAIRDESK_PRELOAD_ENABLED=0` remains the rollback control for a rebuilt client bundle; ordinary queries and Realtime remain independent.
- Release commit and remote hash will be recorded after the scoped push.
