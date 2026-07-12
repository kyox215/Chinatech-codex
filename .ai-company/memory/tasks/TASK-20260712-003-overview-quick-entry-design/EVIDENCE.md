# Evidence

## Baseline

- Owner approved implementation and direct push to `main`.
- Isolated branch: `codex/overview-quick-entry-20260712`.
- Initial base: `origin/main@77e7410e524b`.
- Final integration base: `origin/main@f34ef2d293b6`; this includes the concurrent global staff permissions task.
- Original shared checkout remains dirty and is excluded from implementation.

## Implemented evidence

- Quick-start UI and state handling: `src/features/dashboard/screens/dashboard-screen.tsx`.
- Confirmed empty-state copy: `src/features/dashboard/model/dashboard-work-insights.ts`.
- Empty-state unit coverage: `src/features/dashboard/model/dashboard-work-insights.test.ts`.
- Route, responsive, loading and hard-error browser coverage: `tests/e2e/dashboard-quick-start.spec.ts`.

## Verification so far — 2026-07-12T02:49:12Z

- Targeted work-insight test: 1 file / 3 tests passed.
- Scoped ESLint: passed.
- Full typecheck: passed.
- Agent config/template/rule checks: passed.
- Dashboard Playwright: 7/7 passed with one worker.
- Playwright viewports: 390x844, 430x932, 768x1024, 1024x768, 1440x900.
- Browser DOM proof at 390 and 1440: correct two hrefs, exactly one responsive action surface, no overlay, no horizontal overflow.
- First full Vitest attempt was invalidated by resource contention while full ESLint and Next dev were running concurrently: 15 unrelated tests timed out at the common 5-second threshold; a serial rerun is required before release.

## Final release gates — 2026-07-12T03:33:00Z

- Required toolchain: Node 22.12.0, matching `.nvmrc` and `package.json` engine.
- Full Vitest before the final rebase: 114 files / 761 tests passed.
- Full typecheck under Node 22: passed.
- Production build under Node 22: passed; 22 static pages generated. The first sandboxed attempt failed only because Turbopack could not bind its internal local port; the approved non-sandbox build passed.
- Agent config/template/rule checks: passed.
- ESLint under Node 22: all 942 lintable files passed with the repository config. Live source was confirmed through `npm run lint` while excluding binary/generated evidence directories; the archived `exports` tree was linted separately with the same config. Plain `eslint .` spends unbounded time traversing generated/binary directories in this checkout, so it was not accepted as evidence by itself.
- `git diff --check`: passed.
- Additional AI Company validation found 12 pre-existing duplicate Agent names in the untouched governance configuration; official `npm run agents:check` passed and this task changes no Agent definition.

## Post-rebase integration — 2026-07-12T03:44:55Z

- The remote advanced by two commits while this task was preparing release. The implementation commit was rebased onto `f34ef2d293b6`.
- Dashboard conflict resolution preserved the new permission task's aggregate-finance guard, finance-redacted order handling, role-dependent fourth metric and “待处理” copy.
- Quick-start actions, loading/error tri-state and fallback queue total were retained.
- Post-rebase typecheck, targeted unit and scoped ESLint passed.
- Post-rebase full Vitest: 119 files / 800 tests passed with one worker.
- Post-rebase Playwright: 7/7 passed across all five viewports and error/loading scenarios.
- Post-rebase production build: passed; 22 static pages generated.
- Mobile and desktop screenshots were recaptured from the integrated final UI; no browser overlay or horizontal overflow was present.

## Visual evidence

- `screenshots/TASK-20260712-003-overview-quick-entry-design/overview-quick-start-mobile-390x844.jpg`
- `screenshots/TASK-20260712-003-overview-quick-entry-design/overview-quick-start-desktop-1440x900.jpg`

## Review evidence

- FLOW/Product review confirmed the direct-entry model and iPhone-specific buyback copy.
- UX review found no blocker and requested accurate hard-error states plus 768/1024 evidence; both were implemented.
- FE/Explorer final static review found no P0/P1 after the corrections; runtime E2E, screenshot, remote refresh and checkpoint remained main-thread conditions.

## Production boundary

- No database, migration, API contract, permission, secret, production data or deployment change.
- Pushing `main` is authorized; production deployment is not claimed by this task.
- `2026-07-12T02:50:41Z` `31d8cedab7` — tests/e2e/dashboard-quick-start.spec.ts 7/7 passed; screenshots/TASK-20260712-003-overview-quick-entry-design; targeted unit 3/3; typecheck and agents:check passed
- `2026-07-12T03:36:51Z` `a4ad184209` — Node 22.12.0; Vitest 114 files/761 tests; Playwright 7/7; build 22 pages; typecheck and agents:check passed; two screenshots
- `2026-07-12T03:45:32Z` `dedc457b06` — origin/main@f34ef2d293b6; Vitest 119 files/800 tests; Playwright 7/7; build 22 pages; final 390/1440 screenshots
