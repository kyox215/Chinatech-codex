# Checkpoints — TASK-20260831-002-i18n-deep-ui-release-a

## 2026-08-31T15:45:25Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-08-31T16:03:06Z — Audit complete and Release A contract frozen

- **Phase:** plan / contract freeze
- **Completed:** Registry binding and Context Packet verification; explicit Goal creation; reproducible audit baseline; independent code-inventory and Product/UX reviews; one bounded cross-question pass.
- **Evidence:** `node scripts/audit-i18n-ui-text.mjs --summary` = 5,839 occurrences / 4,213 unique; both reviewers converged on Dashboard + Orders Queue after comparing New Order and three-list alternatives.
- **Decision:** Release A covers Dashboard quick/priority surfaces and the `/orders` list workspace only. New Order, Order Detail, Customers, Inventory, print/customer/legal content and all data/API/persistence changes are excluded.
- **Risk:** T3 / R3 / L2. Production deployment is authorized only after full gates; any API/schema/auth/permission/tenant/persistence/dependency/env/config coupling is a stop condition.
- **Next:** delegate the frozen allowlist to one Luna writer, then run independent review, full gates, controlled browser evidence and existing-project release.

## 2026-08-31T16:58:57Z — Runtime-derived copy gap added to the display contract

- **Phase:** implementation review
- **Completed:** all direct Han-script literals in the frozen production TSX allowlist were removed; targeted lint and typecheck passed.
- **Evidence:** a second integration read found fixed Chinese labels still reachable through `orderQueueGroupMeta`, task guidance, financial-state metadata, workflow/exception metadata and Dashboard priority projections even though the consuming TSX files returned zero Han-script literals.
- **Decision:** keep the Release A product scope unchanged, but add a bounded display-only adapter for stable system codes/known system guidance. Preserve store-defined workflow labels and dynamic customer, device, supplier, repair-item and assignee data verbatim.
- **Risk:** no API/schema/auth/permission/query/payload/persistence change is allowed. Shared badge changes are limited to backward-compatible optional display labels supplied by the localized Orders list.
- **Next:** the existing single Luna writer will close this runtime gap and add focused locale/custom-label tests before independent review.

## 2026-08-31T17:34:00Z — List-only badge boundary clarified

- **Phase:** implementation review
- **Completed:** verified that the Orders Queue consumes shared `OrderTypeBadge`, `DeviceCustodyBadge`, and `DeviceUnlockListBadge`, whose default labels come from fixed Chinese model metadata.
- **Decision:** permit only backward-compatible optional display-label props on those three badges. Existing defaults and every unlock editor/viewer behavior remain unchanged; the localized Orders Queue supplies translated labels.
- **Risk:** no shared model, persisted unlock value, permission, reveal behavior, or non-list screen may change.
- **Next:** wire desktop/mobile list consumers and prove Chinese baseline plus Italian/English rendering in focused component tests.

## 2026-08-31T18:20:00Z — Language-switch scroll capture added to the bounded allowlist

- **Phase:** controlled browser validation
- **Completed:** Chromium proves locale, URL, document identity, search and selected order remain stable, while the scroll assertion remains at `0` instead of the pre-switch `240` even after a five-second poll.
- **Decision:** retain the strict scroll requirement and permit the existing single writer to change only `src/components/language-switcher.tsx` and its focused test so the pre-interaction position is captured before Radix/focus handling; keep the existing double-frame restore.
- **Risk:** no reload, navigation, Cookie, query, API, persistence, permission or layout contract may change. The Release A E2E assertion must not be weakened.
- **Next:** issue instruction/context version 3, implement the minimal capture fix, then rerun Chromium and WebKit.

## 2026-08-31T18:25:00Z — Scroll failure reclassified as a test-driver pre-scroll

- **Phase:** controlled browser validation
- **Completed:** pointer-capture product change did not alter the result; direct bounding-box evidence showed the Orders language trigger at `y=-234.5` after scrolling, before Playwright attempted the locator click.
- **Decision:** retract the shared `language-switcher` source/test expansion. Playwright's locator action was moving the document before the component received a pointer event, so the E2E will dispatch the same Radix pointer event without the driver's scroll-into-view side effect.
- **Risk:** the strict final equality to the original `240` remains. This diagnosis does not authorize AppShell/sticky layout work or weaken state-preservation acceptance.
- **Next:** issue instruction/context version 4, restore the shared component baseline, then rerun both browser engines.

## 2026-08-31T18:43:00Z — Final QA gaps classified before release gates

- **Phase:** quality-gate iteration
- **Completed:** focused regression is green at 14 files / 117 tests; the browser write detector now catches all same-origin RepairDesk POST/PUT/PATCH/DELETE requests except the explicitly read-only queue-summary POST.
- **Decision:** add non-default filter, second-page and Dashboard Italian/English runtime evidence. Treat an already-open mobile filter modal as not applicable because its focus trap makes the external language switcher unreachable; do not change product modal behavior to manufacture that path. Register Orders/Dashboard scanner-sheet bodies as a Release A exception and Release B scanner-boundary item; only their Release A triggers are localized.
- **Risk:** QA found incorrect Italian/English singular relative-time grammar. This is a release blocker until one-hour/day/month/year cases are fixed without changing the Chinese baseline and covered in all three locales. Batch feedback may only be tested through a pure display contract or controlled in-memory state; no actual mutation request is permitted.
- **Next:** complete the bounded writer corrections, rerun focused and dual-engine browser suites, then request final QA/security/architecture verdicts.

## 2026-08-31T19:11:00Z — Release A implementation and local quality gates complete

- **Phase:** release gate
- **Completed:** corrected singular Italian/English relative time, added pure three-locale complete/partial bulk feedback, three-locale Orders empty states, Dashboard runtime switching, non-default queue/view/page/search/selection/scroll preservation, offline cached/no-cache, cached refresh failure and all-false permission hiding. Final current browser spec passes Chromium 10/10 and WebKit 10/10 with zero detected business writes.
- **Evidence:** independent focused QA 15 files / 141 tests; full repository ESLint and typecheck PASS; 469 files / 3,148 tests PASS; Next production build 30/30 PASS; final audit 5,599 / 4,088; screenshots for Italian 1440, English 390 and Chinese 768 plus WebKit copies.
- **Decision:** scanner Sheet bodies remain a registered Release B exception; dynamic customer/device/repair/assignee data remains verbatim. The mobile filter modal's external switcher path is not executable under the existing focus trap and is not manufactured by changing product behavior.
- **Risk:** implementation QA has no BLOCKER/MAJOR. Await the final independent security verdict and remote/deployment freshness checks before commit/push/deploy.
- **Next:** synchronize final security/release evidence, complete the writer work package, fetch origin, inspect/stage/commit, non-force push and deploy the existing Vercel production project.

## 2026-08-31T19:26:58Z — Independent security gate passed

- **Phase:** release gate
- **Completed:** the final security reviewer inspected the exact Release A working-tree delta, permission/data boundaries, safe error handling, display-only adapters and controlled browser no-write detector.
- **Evidence:** PASS with BLOCKER 0 / MAJOR 0 / MINOR 0; independent 14 files / 149 tests, typecheck and targeted ESLint passed; WebKit 10/10 machine report and `writesByPage=[]` evidence verified.
- **Decision:** no security or data-boundary release blocker remains. Keep the E2E workspace loopback-only and do not expand the three-endpoint read-only POST allowlist without a new semantic/permission review.
- **Risk:** the detector records then fails at assertion time rather than aborting requests. Because every controlled page case emitted zero writes and the target is loopback mock only, this is a future defense-in-depth improvement, not a current defect.
- **Next:** finish the current-candidate architecture/UX verdict, then stage the exact frozen scope and run final freshness/release controls.

## 2026-08-31T19:29:14Z — Architecture and UX/a11y gate passed

- **Phase:** release gate
- **Completed:** a fresh reviewer inspected the current `fdeb7b13...`-based Release A diff instead of relying on the prior localization task verdict.
- **Evidence:** PASS / GO with BLOCKER 0 / MAJOR 0 / MINOR 2; responsive 390/768/1440, language state preservation, accessible states, display-only adapters and no forbidden API/data/config drift were confirmed.
- **Decision:** scanner Sheet body copy remains the registered Release B boundary; the mobile filter focus trap remains correct modal behavior. The prior reviewer-suggested rollback anchor was superseded by the Integration Lead's fresh Vercel inspection: current production is `dpl_3RdXnkLLsoH1S8hJZZT1GGGBGvkf` at Git SHA `fdeb7b13...` and is the preferred pre-Release-A rollback point.
- **Risk:** the existing automated 1440 screenshot was captured before the list entrance animation fully settled. Refresh it after a deterministic wait with the development indicator hidden; this is evidence-only and does not change the product contract.
- **Next:** refresh the screenshot and dual-engine evidence, then stage, fetch, commit and release.

## 2026-08-31T19:36:57Z — Stable visual evidence and dual-engine rerun complete

- **Phase:** release gate
- **Completed:** the Italian desktop screenshot now waits until the last order row reaches computed opacity `1`; the Next development indicator is hidden before capture. Chromium and WebKit were rerun against isolated loopback mock servers.
- **Evidence:** Chromium 10/10 PASS; WebKit 10/10 PASS; refreshed 1440 screenshot was visually inspected and is clear with no development overlay. Target E2E ESLint, typecheck, final audit 5,599 / 4,088 and diff-check passed; generated `next-env.d.ts` was restored and verified clean.
- **Decision:** the architecture/UX visual-evidence MINOR is closed. The remaining scanner Sheet body item is intentionally scheduled for Release B and is not a Release A defect.
- **Risk:** no production, business mutation or customer data was used. Local ports 3137/3138 were confirmed closed after the runs.
- **Next:** stage the exact candidate, fetch and verify remote freshness, commit, non-force push, then observe the existing Vercel Git deployment.

## 2026-08-31T19:46:04Z — Release A application deployment verified

- **Phase:** closeout
- **Completed:** created application commit `cb13b7125fad9ab7c507f6a15f5a46f259a4780f`, performed a fresh remote check, pushed `main` without force, and observed the existing Vercel Git production deployment `dpl_8MT1dcNE2TD3qQYZ8uS49NzxRoDv` reach READY at the same Git SHA.
- **Evidence:** both production aliases point to the deployment; public smoke checks resolve `/`, `/orders`, `/login`, `/r` and `/kiosk` to 200 after expected auth redirects; direct unauthenticated `/orders` remains 307 to `/login?next=%2Forders`; the deployment returned no error-level runtime logs.
- **Decision:** the primary rollback anchor is the freshly observed pre-release deployment `dpl_3RdXnkLLsoH1S8hJZZT1GGGBGvkf` at `fdeb7b13...`, not an older historical deployment.
- **Risk:** no production credentials were used, so the authenticated employee UI was not exercised against real customer data. The equivalent full flow was proven in the controlled dual-engine mock matrix and stable screenshots.
- **Next:** commit/push this memory-only closeout, verify its automatic production Git deployment matches the final SHA, then close Registry and Goal without another repository edit.
