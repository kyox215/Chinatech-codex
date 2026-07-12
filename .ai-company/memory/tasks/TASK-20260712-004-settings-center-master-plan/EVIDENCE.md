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

## WP-03A — Customer-output recovery

- Resolver matrix: ready, loading, failed read, missing store binding, tenant mismatch, legacy contamination, missing store profile, notification-only gaps, and mixed gaps.
- Focused regression: 5 files / 21 tests passed. Three message dialogs keep selectors/body and primary send actions disabled while identity is blocked.
- Independent security review after corrections: PASS, P0=0 / P1=0. Blocked results still clear all five output fields; recovery URLs contain no store/customer ID or field value.
- Independent UI/accessibility review after corrections: PASS, P0=0 / P1=0. Cross-tab repair has a deterministic recheck; blocked message drafts cannot be overwritten; new-tab name, `aria-busy`, labels, and mobile 44px targets are covered.
- Static gates: agents check, lint, typecheck, and diff check passed.
- Bounded full regression: 139 files / 902 tests passed with two workers.
- A four-worker exploratory run hit two timing failures in the pre-existing Radix order-option-picker test. The same file passed 5/5 alone, and the complete two-worker run passed 902/902; no product-code failure remained.
- Dedicated output-recovery Playwright: 2/2 passed at 390x844 and 1440x900. It verifies exact PII-free Settings href, new-tab isolation, disabled send/edit controls, 44px mobile actions, no page overflow, recheck-to-ready, and pointer-lock cleanup after dialogs close.
- Dedicated Settings Playwright after WP03-A: 16/16 passed across all six approved viewports and global dirty-guard surfaces. Dev-server canceled RSC `ECONNRESET` noise appeared only after successful assertions and did not fail the gate.
- Production build: passed outside the filesystem sandbox because Turbopack requires local process/port access.
- Browser testing exposed and verified a related interaction defect: the mobile orders header was first measured while only the skeleton existed, so the 160px fallback covered the first card. The effect now remeasures after the initial orders request settles; standard Playwright click reaches the first order without `force`.
- Screenshots use mock data and mask notification type, phone, and message body:
  - `screenshots/responsive-density/settings/output-recovery-390x844.png`
  - `screenshots/responsive-density/settings/output-recovery-1440x900.png`
- No migration, production write, role change, external message, `main` push, or deployment occurred.
- `2026-07-12T14:03:54Z` `9bca3ef2b0` — branch codex/settings-center-v2-20260712 ahead 4; uncommitted settings WP03B files/screenshots preserved; no production/push

## WP-03B — Account and store settings

- Independent security review: PASS; P0=0/P1=0.
- Independent UI/accessibility review: PASS; P0=0/P1=0.
- Settings Playwright: 21/21 passed across 390–1440px, including 44px actions, saved-vs-draft output state, semantic read-only profile, confirmed independent-store creation, mobile return guard, no floating dock on Settings, and focused-address pointer hit.
- Production build passed outside the sandbox after the sandboxed run failed only because Turbopack could not bind its helper port.
- Typecheck, changed-file ESLint, and diff check passed.
- Full-suite exploratory Vitest failures were unrelated 5-second timing limits; `order-option-pickers` and order-data workbook each passed 5/5 alone.
- Screenshots:
  - `screenshots/responsive-density/settings/wp03b-account-390x844.png`
  - `screenshots/responsive-density/settings/wp03b-store-1280x800.png`
  - `screenshots/responsive-density/settings/wp03b-store-create-confirm-1280x800.png`
  - `screenshots/responsive-density/settings/wp03b-store-draft-390x844.png`
  - `screenshots/responsive-density/settings/wp03b-store-readonly-390x844.png`
- No migration, production write, role/retention change, external message, `main` push, or deployment occurred.
