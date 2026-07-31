# Evidence — TASK-20260731-003

Status: quality gate PASS; release pending
Candidate worktree: `/private/tmp/repairdesk-inventory-mobile-density-20260731`
Implementation baseline: `b6332f8c`

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
| Exact-SHA preview/production and runtime smoke | release step pending | PENDING |

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

- Chromium: 16/16 inventory cases PASS.
- WebKit: 16/16 inventory cases PASS.
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

## Pending release evidence

- Independent QA verdict: PASS / GO; no open P0/P1/P2.
- Integration lease acquisition/recheck.
- Candidate commit and remote branch SHA.
- Vercel preview/production deployment IDs, URLs and exact SHA.
- Production build/runtime logs and read-only smoke.

## External publication blocker

- Local integration candidate: `ab0b7d6029d4e27a2b3bddde05b4537ece8d9f1d`.
- `origin/main` remained `a9e6db44`; it was merged without changing the verified candidate tree, so the eventual main update is non-force and fast-forward.
- Push to `git@github.com:kyox215/Chinatech-codex.git` was rejected by the external-action approval reviewer because the repository is public and the commit includes internal inventory implementation, tests, project documentation and synthetic UI screenshots.
- No push or deployment occurred. Resume only after Owner explicitly confirms publication to this exact public repository with the stated contents.
