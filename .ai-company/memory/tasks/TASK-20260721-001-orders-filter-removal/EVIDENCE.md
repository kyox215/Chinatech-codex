# Evidence Index — TASK-20260721-001-orders-filter-removal

| Evidence ID | Type | Claim supported | Source/path/command | Result | Collected at | Collector |
|---|---|---|---|---|---|---|
| E-001 | request | task exists and title is recorded | `TASK.md` | observed | 2026-07-21T08:10:40Z | CEO-Orchestrator |

Do not record secrets or unsupported “passed” claims. Prefer stable paths, commit
IDs, test reports, screenshots, or concise log references.
- `2026-07-21T08:10:52Z` `a11851de7c` — `src/features/orders/screens/order-list-screen.tsx`; `tests/e2e/orders-mobile-queue-loading.spec.ts`; `npm run lint` pass; `npm run typecheck` pass; `npm run test` 329 files / 2,154 tests pass; `npm run build` pass; Playwright `orders-mobile-queue-loading` 3 pass; `test-results/orders-mobile-queue-loadin-db06c--the-redundant-filter-entry-chromium/orders-1440-desktop-toolbar.png`.
- `2026-07-21T08:12:06Z` `c231cf7a73` — HEAD=origin/main=a9856421dfd77430af8faeeb1a3576a5d8ad0ddb before local changes; git diff --check=pass; agents:check=pass; lint/typecheck/2154 tests/build/3 Playwright tests=pass; 1440px screenshot confirms filter button absent.
- `2026-07-21T10:29:29Z` `57cedcae6b` — Owner approval: 部署; origin/main=d796feca69d12ef9884baaae7bf690b4c5202e16; production baseline=dpl_63vFKJhMDrHh5zGQxsdcVKurEGBZ READY; QUALITY_GATE.md PASS; SECURITY_REVIEW.md PASS; RELEASE.md
- `2026-07-21T10:32:35Z` `a4491232e9` — Release candidate before amend=791f42a3a20c732772825b9b99a0abfad5b0610f; origin/main=d796feca69d12ef9884baaae7bf690b4c5202e16; lint=pass; typecheck=pass; vitest=331 files/2163 tests pass; build=pass; Playwright=3 pass; git diff check=pass
