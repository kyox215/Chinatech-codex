# Evidence — TASK-20260731-003

Status: closed; quality and production release PASS
Candidate worktree: `/private/tmp/repairdesk-inventory-mobile-density-20260731`
Final Git SHA: `44b1d80cff25a4ceab6de995a748d0d9e024e955`

## Acceptance-to-evidence matrix

| Acceptance | Evidence | Result |
|---|---|---|
| List/intake/edit access gates prevent restricted requests | `inventory-product-access-gates.test.tsx`: UI flag off, update denied, shell loading | PASS |
| Previous list data never crosses store scope | `query-options.test.ts`: same-store filter retains; other/unscoped store returns no placeholder | PASS |
| Old detail response without `identifiers` renders safely | `inventory-product-detail-screen.test.tsx` compatibility case | PASS |
| 390px list 84–88px and sixth item visible | Chromium + WebKit `inventory-product-mobile-density.spec.ts` | PASS |
| Five categories, touch ≥44px, input ≥16px, fixed actions | Chromium + WebKit density spec and screenshots | PASS |
| 430px detail is dense, bounded and identifier appears once | Chromium + WebKit density/option-C specs | PASS |
| Edit field errors and fixed action bar | Chromium + WebKit density spec | PASS |
| Existing intake/detail/filter/error flows regressions | Chromium + WebKit `inventory-product-simplification.spec.ts` | PASS |
| No horizontal overflow across 390/430/768/834/1024/1440 | Chromium + WebKit density/simplification/option-C specs | PASS |
| No API/schema/permission/migration product diff | `git diff --name-status b6332f8c`, independent review pending | PASS (static) |
| Full repository lint/type/test/build | commands below | PASS |
| Exact-SHA preview/production and runtime smoke | Vercel build logs, READY deployments, login redirect smoke, error log query | PASS |

## Executed commands

### Static and unit gates

- `npm run lint` — PASS.
- `npm run typecheck` — PASS.
- `npm run test` — PASS before review: 388 files, 2538 tests; PASS after QA remediation: 389 files, 2540 tests.
- `npm run build` — PASS after allowing the build to fetch the three Google Fonts configured by the project.
- Production-equivalent canary build with `INVENTORY_V2_SCHEMA_READY=1`, `INVENTORY_V2_COMMANDS=1`, `INVENTORY_V2_UI=1`, `INVENTORY_PRODUCT_DEVICE_DATA_V2=1`, and the Chinatech store allowlist — PASS.
- `git diff --check` — PASS.

Independent QA initially reproduced a P1: unconditional `keepPreviousData` could keep store A's list visible after changing the observer to store B. Release was stopped. The implementation now checks the previous query key against the current `inventory-products/list/store/<storeId>` scope; cross-store and unscoped previous data return `undefined`. The same QA reproduced the fixed QueryObserver behavior, confirmed the action-bar alignment fix, and returned PASS / GO with P0/P1/P2 = 0/0/0.

The first sandboxed build attempt failed only because outbound Google Fonts access was blocked; the same build succeeded with network permission. No compile or TypeScript failure occurred.

### Browser gates

E2E used the repository's isolated mock actor and synthetic masked product data:

- Final isolated Chromium matrix: 22/22 inventory cases PASS.
- Final isolated WebKit matrix: 22/22 inventory cases PASS.
- Post-QA remediation: Chromium density 5/5 and WebKit density 5/5 PASS, including action-bar left/right inset symmetry.

The test set contains 5 new density cases, 2 option-C privacy/detail cases, and 9 existing simplification/resilience cases. WebKit's development mock emitted the existing shell-permission SSR/client hydration warning during cross-viewport reuse; all assertions passed and the stack is in the pre-existing `RepairOsListScaffold` permission action, not a changed line. Independent QA will decide whether this is release-blocking.

An attempted `next start` browser run correctly rendered permission-denied pages because `isRepairDeskE2eSystemActor` disables the E2E system identity when `NODE_ENV=production`. This is a security control, not a product failure; production deployment will use real read-only smoke instead of enabling a test identity.

## Visual evidence

Directory: `artifacts/screenshots/TASK-20260731-003-inventory-product-mobile-density/`

- `chromium-390-product-list-dense.png` — dense list with eight synthetic items, six complete cards visible.
- `chromium-390-product-intake-core.png` — five categories, compact core fields and fixed dual actions.
- `chromium-430-product-detail-dense.png` — full core workbench, identity and notes in one 430×932 page.
- `chromium-390-product-edit-validation.png` — field-level brand error and fixed save actions.
- `chromium-1024-product-list-dense.png` — bounded six-column desktop list.
- Matching five WebKit screenshots cover Safari rendering.

Screenshots contain only synthetic products and masked identifiers. The test hides the Next development portal immediately before image capture; assertions and business UI are unchanged.

## Documentation impact matrix

| Area | Action |
|---|---|
| Complete next-phase product/UX/release plan | Added `docs/INVENTORY_PRODUCT_MOBILE_DENSITY_NEXT_PLAN.md` |
| Existing device-data/mobile implementation | Updated density, identity de-duplication and conflict boundary |
| Responsive standard | Added verified inventory card/category/action/detail sizes |
| RepairOS mobile detail standard | Added inventory detail workbench variant |
| API/data/migration/runbook | No change; no contract, schema or operational migration change |

## Release evidence

- Owner explicitly approved public publication of inventory implementation, tests, project documentation and synthetic screenshots to `kyox215/Chinatech-codex`, plus Vercel production deployment.
- The release waited for the live sitewide-density integration lease to release. Latest `origin/main@1c9f4574` was then merged non-force into the task branch. The sole content conflict in `src/app/inventory/page.tsx` retained `InventoryProductListScreen` while adopting the compact fallback.
- Shared `surfaces.stickyActions` reintroduced `sm:-mx-6` at desktop widths. Adding `sm:mx-0` to product intake/edit actions removed the observed 24px `main/form` overflow; targeted 4/4 and final Chromium/WebKit 22/22 passed.
- Branch `codex/inventory-mobile-density-20260731` and public `main` were pushed non-force to exact SHA `44b1d80cff25a4ceab6de995a748d0d9e024e955`.
- Preview `dpl_BB2ZVNsndkBNoUYc44eRsJoebs5a` is READY at `https://chinatech-codex-mz8pdlsrl-kyox120-9295s-projects.vercel.app`; build log states branch `codex/inventory-mobile-density-20260731`, commit `44b1d80`.
- Production `dpl_CVHwY9EHq2qJQuTcmngTpCuWyWjs` is READY at `https://chinatech-codex-64ileyhj4-kyox120-9295s-projects.vercel.app`; build log states branch `main`, commit `44b1d80`.
- Stable main alias `/inventory` returned the expected 307 authentication redirect to `/login?next=%2Finventory`, then 200. Exact-deployment error-log query for the first 10 minutes returned no error entries.
- No production inventory mutation, database migration, environment-variable change, customer data read or secret handling occurred.

## Documentation impact and drift result

- Updated authoritative inventory next-phase plan, device-data implementation, responsive density plan and RepairOS mobile detail standard earlier in this task.
- Final release evidence, closeout, memory delta and capability review now supersede the former publication-blocker handoff.
- API/data/migration/operator runbooks required no behavioral update because the release is application-only and contains no contract or production-data operation.
- Public artifacts were checked to contain only synthetic products and masked identifiers; no secrets or customer PII were added.
