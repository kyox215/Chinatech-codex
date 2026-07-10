# Evidence

## Baseline

- Branch: `codex/realtime-preload-20260710`.
- Worktree: `/private/tmp/repairdesk-realtime-preload-20260710`.
- Base: `origin/main` at `73eb5095a8b26fdf68349ffba02742d9ab568fcc`.
- Original checkout remains dirty and is not used for implementation.

## Planned Evidence

| Acceptance | Evidence |
|---|---|
| Realtime event cancels stale prefetch | Coordinator integration test with deferred query |
| Event burst coalesces | Fake-timer request/invalidation count test |
| Optimistic rollback is guarded | Order cache mutation generation test |
| Store switch isolation | Tenant cache cancellation/removal test |
| Reconnect catch-up | Realtime provider status transition test |
| Warm navigation | Browser network/timing evidence |
| UI state | Mobile and desktop screenshot without production PII |
| Release gates | lint, typecheck, test, build, scoped diff and remote hash |

## Implementation Evidence - 2026-07-10T22:38:51Z

- Coordinator/preload/realtime/tenant/API targeted suites: passed.
- Full Vitest before final review edits: 110 files, 743 tests passed.
- `npm run lint`: passed before final review edits.
- `npm run typecheck`: passed before final review edits.
- `npm run build`: passed outside the sandbox after Turbopack's sandbox-only internal port restriction; 22 static pages generated.
- `tests/e2e/realtime-preload-coordination.spec.ts`: 2/2 passed against controlled mock auth.
- Desktop browser proof: one `customers/list-page` request warmed on `/orders` and reused during Next.js SPA navigation to `/customers`.
- Mobile browser proof: visible compact sync state at 390x844 and `scrollWidth <= clientWidth + 1`.
- Final lint: passed.
- Final typecheck: passed.
- Final Vitest: 110 files / 747 tests passed.
- Final Agent checks: config, templates, and rules passed.
- Final production build: passed; 22 static pages generated.
- Final controlled Playwright: 2/2 passed with required mock-auth and Realtime UI flags.
- Request-count proof: one scoped order queue request; one customer preload request reused after SPA navigation.
- Independent Security review: no code blocker; production Realtime authorization remains a separate approval gate.
- Independent QA blocker about skipped E2E: resolved by the final gated 2/2 run.
- Independent Release review conditions: all code-only preconditions satisfied; production Realtime activation remains no-go.
- Remote hash verification is recorded below.

## Release Evidence - 2026-07-10T22:51:06Z

- Implementation commit: `96f3197d480a44385bc179d5c27bc342a7f9e186`.
- Push result: `73eb5095..96f3197d  HEAD -> main`.
- Verified `origin/main`: `96f3197d480a44385bc179d5c27bc342a7f9e186`.
- Production database and Realtime activation remained untouched and approval-gated.
