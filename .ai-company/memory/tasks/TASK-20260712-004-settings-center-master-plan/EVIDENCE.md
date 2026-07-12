# Evidence

## WP-00

- Baseline: `origin/main@a76852f61b09f1b84ccf0def957312026d6eb3b3`
- Isolated worktree: `/private/tmp/repairdesk-settings-center-20260712`
- Branch: `codex/settings-center-v2-20260712`
- Targeted regression: 15 files / 136 tests passed.
- Full regression on the latest security-fixed snapshot: 125 files / 832 tests passed with two workers.
- Static gates: agents check, lint, typecheck passed.
- Production build: passed after rerunning outside the sandbox due a Turbopack internal port-bind restriction.
- Independent security review: PASS; no remaining P0/P1 blocker.
- Visual evidence: deferred to WP-01/03 because WP-00 is primarily security/capability/output-contract work; no production or customer data was used.

## WP-01

- Independent integration/security closeout: PASS; no remaining P0/P1 blocker.
- Static gates: agents check, lint, typecheck, and diff check passed.
- Full regression: 132 files / 854 tests passed with two workers.
- Dedicated Settings E2E: 9/9 passed across 390x844, 430x932, 768x1024, 1024x768, 1280x800, and 1440x900.
- E2E also passed all nine deep links, unknown fallback, back/forward, mobile center hit targets, page overflow, and blocked member-domain zero requests.
- Production build passed outside the sandbox due Turbopack internal port binding.
- Browser inspection found no error overlay or console errors and confirmed 44x44 mobile return, tablet rail hidden, 1440 rail at 240px sticky, and content width at 884px.
- Screenshots:
  - `screenshots/responsive-density/settings/overview-390x844.jpg`
  - `screenshots/responsive-density/settings/store-390x844.jpg`
  - `screenshots/responsive-density/settings/overview-768x1024.jpg`
  - `screenshots/responsive-density/settings/overview-1440x800.jpg`

## WP-02

- Strict request/CAS coverage: contract, draft model, repository, service, router, Realtime, API client, and tenant-isolated mock tests.
- Independent security/architecture review: PASS, P0=0 / P1=0; independent target run 7 files / 51 tests.
- Independent UI/navigation/QA re-review: PASS, P0=0 / P1=0; independent target run 3 files / 23 tests plus four new navigation E2E scenarios.
- Static gates on the latest snapshot: agents check, lint, typecheck, and diff check passed.
- Latest focused regression: 3 files / 24 tests passed, including three-way rebase, multi-section save/discard/failure, multiple guard sources, 422 focus, switch/create failure retention, account-name guard, and empty-name blocking.
- Latest bounded full regression: 136 files / 887 tests passed with `--maxWorkers=4`.
- Dedicated Settings E2E: 16/16 passed with one worker across 390x844, 430x932, 768x1024, 1024x768, 1280x800, and 1440x900.
- E2E navigation surfaces: settings rail, overview/return Links, AppSidebar, CommandPalette, MobileWorkspaceDock, ScanSearch, store switch, browser back/forward, and blocked member-domain zero requests.
- Production build: passed outside the filesystem sandbox because Turbopack requires local process/port access.
- Browser evidence remained mock-only and contained no production customer data. WP-02 changes visible interaction states but reuses the WP-01 responsive page layout; final workflow screenshots remain part of WP-08.
- No database migration, production write, role change, `main` push, or deployment occurred.
