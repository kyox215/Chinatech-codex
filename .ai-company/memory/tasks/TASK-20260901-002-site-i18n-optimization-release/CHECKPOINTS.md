# Checkpoints — TASK-20260901-002-site-i18n-optimization-release

## 2026-09-01T07:54:13Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-09-01T07:55:58Z — T3/R3 phased release contract drafted

- **Phase:** context_ready / pre-plan.
- **Completed:** Registry task/run/window bound to the main-thread Integration Lead; prior audit accepted as the evidence baseline; owner authorization normalized into three separately gated release lines; long-running budgets, one-writer rule, approvals, exclusions, acceptance and rollback boundaries recorded.
- **Decisions:** start with Release 1 only. Do not combine deep translation, dependency/runtime upgrades and large structural refactors into one writer batch or one unreviewed release.
- **Known workspace:** business source matches current `main`; prior closed audit Task Memory and current governance files are the only known local changes. They are preserved and must be separated from source review.
- **Risks/blockers:** exact Release 1 file allowlist and compatible security/header/CI behavior are not frozen until independent Product/UX, Architecture/Release and QA/Security views return. No source write yet.
- **Next:** issue/verify immutable Context Packet, spawn at most two read-only reviewers, inspect exact paths and official current dependency/runtime guidance, then freeze Release 1.
- **Budget:** current milestone Release 1; soft 45m, hard 90m, cumulative wait <=20m, at most two active sidecars, no nested delegation.

## 2026-09-01T08:18:00Z — Release 1 contract frozen after independent review

- **Phase:** planned / ready for single writer.
- **Completed:** fresh `main` baseline and focused tests verified; Product/UX and Architecture/Release reports arbitrated; exact source allowlist, acceptance matrix, exclusions, stop conditions and forward-revert strategy frozen in `TASK.md`.
- **Decisions:** use non-path-filtered CI matrix; expand audit to TS without a whole-repository zero-Han gate; preserve unknown/dynamic titles and data; correct fixed Kiosk messages only; bound Auth changes to safe inline failures and Register Complete truthfulness; no dependency/runtime/global strict-header work.
- **Risks/blockers:** application implementation, full gates, independent final review and browser evidence remain outstanding. Production integration lease is intentionally not acquired yet.
- **Next:** assign one scoped application writer; then run focused/full gates and independent QA/security review.
- **Budget:** wait budget used about 8 minutes; effective progress present; no unresolved P0.

## 2026-09-01T08:35:00Z — Writer slice integrated; full-test Plan Delta

- **Phase:** implementation / validation.
- **Completed:** single writer delivered the frozen Kiosk, metadata/404, bounded Auth, audit, CI/E2E and documentation slice; focused Node 22.12 tests are 40/40, typecheck and lint pass after formatting the prior audit helper.
- **Plan Delta:** the first full Vitest run found exactly two stale Chinese expected-message assertions in `kiosk.repository.test.ts` and `mock-api.test.ts`. Both test-only files are added to the allowlist because the already-approved public-safe Italian message contract intentionally changed; no production behavior or boundary is expanded.
- **Evidence:** first full run 469 files passed / 2 files failed, 3,156 tests passed / 2 failed; both failures were exact expected-string drift, not logic failures.
- **Next:** update the two assertions, rerun focused then full suite, build and browser matrix.

## 2026-09-01T08:46:00Z — Release 1 implementation and browser gates green

- **Phase:** post-implementation independent review.
- **Completed:** stale public-message expectations corrected without behavior expansion; full Node 22.12 lint/typecheck/Vitest/build are green; Chromium and WebKit each pass all 24 required i18n stories; Kiosk/Auth/404 public-state reruns pass 5/5 per engine; six contracted widths have overflow and sanitized screenshot evidence.
- **Evidence:** E-009–E-011; `screenshots/` contains 38 PNG files (5.2 MiB), including Kiosk and Auth error at 390/768/1440 and 404 at all six widths for both engines.
- **Skill fallback:** `$vercel:agent-browser-verify` was loaded, but its prescribed `agent-browser` CLI is not installed or exposed in this workspace. Repository-native Playwright performed the page load, content, error-overlay, interaction, responsive and screenshot checks instead; no browser result is inferred from server start alone.
- **Risks/blockers:** final independent QA and Security reports are pending. Dev-server navigation cancellation produced intermittent `ECONNRESET/aborted` log noise while all assertions completed; production build is clean and release reviewers must classify whether this is informational.
- **Next:** accept or remediate independent findings, freeze/stage exact diff, acquire integration lease, fetch/recheck remote and then commit/release if no P0/P1 remains.

## 2026-09-01T08:49:00Z — Independent review remediation Plan Delta

- **Phase:** final review remediation.
- **Findings:** QA and Security independently caught generated `next-env.d.ts` drift outside the allowlist; QA also found missing provider-error field/input evidence and two omitted known static Auth title keys.
- **Remediation:** restored `next-env.d.ts` byte-for-byte to baseline; added `auth.confirmTitle` and `auth.inviteCompleteTitle` to the existing safe static-title allowlist with unit/E2E title assertions; added one test-only public Auth file for real provider error normalization, focus, `aria-invalid`/`aria-describedby` and input retention across Login/Forgot/Reset.
- **Scope decision:** all changes are test/helper corrections inside the approved UX contract. No API/auth/token/Cookie/permission behavior expands; test-only path added to the allowlist.
- **Next:** run focused tests and return exact evidence to both independent reviewers, then re-run affected lint/typecheck/browser checks.

## 2026-09-01T09:00:00Z — Review-remediated Release 1 candidate is gate-green

- **Phase:** release staging.
- **Completed:** documented the test-only Auth allowlist delta and the seven internal Kiosk audit candidates; restored generated `next-env.d.ts`; extended known static Auth title coverage; added provider-error/focus/input-retention proof; corrected one test query typing issue through the same single writer.
- **Final candidate evidence:** Node 22.12 lint and typecheck PASS; Vitest 472 files / 3,161 tests PASS; production build 30/30 PASS; complete Chromium and WebKit matrices each 24/24 PASS with zero skips; `git diff --check` and exact `next-env.d.ts` baseline check PASS.
- **Independent review:** Security final report is CONDITIONAL PASS with no P0/P1. P2s are existing or defense-in-depth risks (CI action pinning/permissions, pairing rate limit, localStorage bearer token, loopback guard) and remain owned follow-up; no exception is claimed.
- **Observation:** Next dev emits intermittent `ECONNRESET/aborted` during fast test-page cancellation, while both browser matrices exit zero and production build is clean. This is recorded as non-blocking test-server noise, not hidden.
- **Next:** obtain final QA verdict, re-fetch `origin/main`, acquire/reverify the integration lease, commit exact candidate, push normally, wait for required GitHub/Vercel checks, then perform public read-only production smoke with the prior READY rollback anchor recorded.

## 2026-09-01T09:06:00Z — Direct `/r` metadata acceptance closed

- **Phase:** exact release candidate.
- **Completed:** added an exact `Stato riparazione — RepairDesk` browser assertion to the existing fixed-customer-route story, proving the repaired `/r` title has one brand suffix. Chromium and WebKit scoped reruns each pass 9/9 with zero skips.
- **Generated-file control:** the scoped Next dev runs rewrote `next-env.d.ts` to their development route-type path; after the final server shutdown it was restored to the committed baseline. Exact baseline diff and full `git diff --check` now return zero, and no further Next dev run is permitted before commit.
- **Next:** final QA verdict, then lease recheck and exact integration.

## 2026-09-01T09:08:00Z — Independent Release 1 QA PASS

- **Phase:** ready to integrate.
- **Verdict:** independent QA reports PASS with no P0/P1; all prior release blockers are closed. Independent Security reports no P0/P1 and retains four non-blocking P2 follow-ups.
- **Release controls:** current window holds project integration lease version 1; `origin/main` was freshly fetched and remains at baseline `8e349b06f9e44883eb3348b434f96ad3f0d409d3`. Owner authorization covers a normal non-force main push and existing production deployment only after exact staging checks.
- **Next:** stage the frozen source, tests, docs and evidence; recheck generated/forbidden paths and lease; commit; push; wait for GitHub/Vercel; perform production public read-only smoke and record rollback anchor.

## 2026-09-01T09:17:00Z — Main CI correctly blocks on browser determinism

- **Phase:** post-push correction.
- **Remote state:** commit `3e9b89520af945cb280f468cc3110d149cbc5e9c` is on `origin/main`; Vercel built it READY, but release acceptance remains paused because GitHub run `33490561926` is red. The prior READY `8e349b06...` remains the rollback anchor.
- **CI evidence:** verify job passed all lint/typecheck/test/build steps. Chromium failed the delayed store-name assertion and post-switch scroll preservation. WebKit failed the same delayed store assertion plus an ambiguous responsive Quick Order locator and an offline-empty story that received seeded mock data.
- **Decision:** no retry/waiver. Freeze the bounded Plan Delta in `TASK.md`, use the same single writer for two language-switcher paths and two existing E2E specs, then repeat both complete matrices before another push.
- **Security/data boundary:** downloaded artifacts contain controlled mocks only. No production login, mutation, secret, customer data or configuration change is involved.

## 2026-09-01T09:31:00Z — Post-CI corrective candidate independently gate-green

- **Phase:** corrective integration staging.
- **Completed:** the same single writer fixed pre-open scroll capture, final AppBar readiness, responsive Quick Order scoping and deterministic offline-no-cache setup within the frozen six-path Plan Delta. Full local Node 22.12 lint/typecheck/Vitest/build are green; Chromium and WebKit each pass 24/24 with zero skips; generated `next-env.d.ts` is restored.
- **Independent review:** QA PASS and Security/Data PASS, no P0/P1. Review confirms no auth/API/data/config change, retry/skip/assertion weakening or fake-green mechanism.
- **Control plane:** GitHub workflow token defaults to read-only, but `main` currently has no branch protection or repository ruleset. The release therefore manually requires all new-SHA jobs green; platform-enforced required checks remain an explicit P2 governance item for Release 3.
- **Deployment state:** first commit `3e9b8952...` is Vercel READY as `dpl_4wZZckLaQqYHeR1joSE3zYiScCLj` and public read-only smoke is healthy. It is not the final Release 1 candidate because hosted browser CI remains red. Prior READY rollback anchor is `dpl_AP6Y4eDmFgukeS4boDjDtqsNEJY3` at `8e349b06...`.
- **Next:** renew/reverify the integration lease, fetch `origin/main`, stage only the six corrected paths, commit and normal-push; require all hosted jobs green on the new SHA, then require its exact Vercel deployment READY and repeat public read-only production smoke.

## 2026-09-01T09:45:00Z — Hosted Chromium isolates remaining close-focus defect

- **Phase:** second corrective implementation.
- **Remote evidence:** commit `6a7bcdb8...` deployed READY as `dpl_14EobMtRCtWpQpW3DugU8oD4xYEm`. GitHub run `33492618893` has verify PASS, WebKit 24/24 PASS and Chromium 23/24 with one scroll failure; no retry or waiver was used.
- **Diagnosis:** the first correction captured the correct pre-open coordinate but left Radix's default close auto-focus in control. Hosted Chromium can therefore focus/scroll the fixed trigger after the scheduled coordinate restoration. All other state assertions and all other Chromium stories pass.
- **Decision:** extend the frozen LanguageSwitcher implementation only: prevent default close auto-focus and focus the existing trigger with `{ preventScroll: true }` for selection/Escape closure. Preserve native outside-dismiss focus/scroll behavior and prove it in the existing real-browser language story. Keep every existing browser assertion unchanged. This is a real runtime focus/scroll fix, not test stabilization by weakening.
- **Next:** focused test with explicit prevent-scroll focus proof, full local gates and both complete matrices; independent follow-up review; then a new exact commit/push and hosted all-green requirement.

## 2026-09-01T09:57:00Z — Selection and outside-dismiss focus contracts both gate-green

- **Phase:** final corrective review.
- **Completed:** selection/Escape closure now suppresses Radix's scrolling auto-focus and returns focus to the same trigger with `preventScroll`; pointer/focus dismissal outside the menu keeps the user's target and does not force coordinate restoration. Existing locale/URL/state/scroll assertions remain unchanged; one additive real-browser outside-focus assertion covers both engines.
- **Final local evidence:** LanguageSwitcher 4/4; Node 22.12 lint/typecheck PASS; Vitest 472 files / 3,164 tests PASS; build 30/30 PASS; complete Chromium 24/24 and WebKit 24/24 PASS, zero skips; `next-env.d.ts` exact baseline and diff-check PASS.
- **Browser nuance:** a synthetic button was not a cross-browser focus target in WebKit/Safari semantics, so the evidence fixture uses a fixed text input that both engines focus explicitly. Product code was not changed to accommodate this platform-test nuance.
- **Next:** obtain final independent QA/Security verdict on the outside-dismiss refinement; then renew lease, fresh-fetch/stage exact six paths, normal commit/push, and require new-SHA hosted verify/Chromium/WebKit plus exact deployment READY and production read-only smoke.

## 2026-09-01T09:59:00Z — Final corrective reviews PASS

- **Phase:** exact integration staging.
- **Independent verdicts:** QA PASS and Security/Data PASS; no P0/P1. The previously identified outside-dismiss focus P2 is closed by the state-machine refinement, focused 4/4 tests and full Chromium/WebKit proof. No new incremental P2 remains; inherited unprotected-main governance debt still requires manual exact-SHA enforcement.
- **Scope:** exact six paths only: LanguageSwitcher, its test, one existing additive browser spec and TASK/CHECKPOINTS/EVIDENCE. No retry, skip, timeout waiver, assertion deletion, dependency, workflow, API, auth, Cookie, data, config or generated-file drift.
- **Next:** fresh-fetch `origin/main`, reverify lease and generated-file baseline, exact stage/commit/push, then block until hosted verify/Chromium/WebKit are all green and the same SHA is production READY with canonical read-only smoke.

## 2026-09-01T10:11:00Z — Release 1 complete on main and production

- **Milestone result:** commit `7d1b59c5e8e61b654beb329444ec1fef03cda2c3` equals `origin/main`. GitHub run `33495161684` completed SUCCESS for verify, WebKit and Chromium. No failed run was retried or waived.
- **Deployment:** `dpl_F8qQS27LxRAHVw3a7m3Dg9FBFPqq` is READY for the existing `chinatech-codex` production target and canonical aliases. Prior READY `dpl_14EobMtRCtWpQpW3DugU8oD4xYEm` is the immediate rollback anchor.
- **Production observation:** apex redirects to `www`; anonymous root and offline route redirect to localized login; `/login`, `/kiosk` and `/r` return 200. Kiosk is fixed `it-IT` with single title and scoped no-store/noindex/frame/content/security headers; `/r` has one RepairDesk title; login SSR honors Chinese, Italian and English locale Cookies. The deployment-specific 30-minute error query returned no logs.
- **Visual evidence:** 38 sanitized Chromium/WebKit screenshots remain tracked under `screenshots/`, covering Kiosk/Auth/404 and the contracted 390/430/768/1024/1280/1440 widths.
- **Residuals:** platform-required checks are not enforced by a branch ruleset; manual exact-SHA release enforcement succeeded. `actions/upload-artifact@v4` emits a Node 20 deprecation annotation on the current runner. Both are Release 3 governance/runtime follow-ups, not hidden Release 1 exceptions.
- **Next milestone:** freeze Release 2 employee deep-interface domain sequence. Do not claim full reachable UI is translated from Release 1 alone.

## 2026-09-01T10:25:57Z — Release 2A Scanner/Camera contract frozen

- **Phase:** Release 2A planned / ready for one bounded writer.
- **Completed:** confirmed `HEAD = origin/main = 7d1b59c5...` with only known Task Memory changes; inventoried production-reachable Scanner/Camera, Order QR, scan-search and local attachment-result consumers; baseline focused tests pass; received independent Product/UX, Architecture/Security and QA views; arbitrated a presentation-boundary-only contract.
- **Decisions:** include the complete local attachment-draft result surface and the two Order Detail camera copy-variant callers for truthful persistence wording; exclude `ImeiScannerField`, parser/QR/token/scan-intent business modules, APIs/payloads/permissions/data/dependencies/config and all broader Orders translation. Use stable safe error kinds and localized presentation helpers; preserve dynamic values and locale-invariant action outputs.
- **Verification contract:** Node 22.12 full gates; three locales x six widths x Chromium/WebKit; focus/Escape/scroll/state-retention and boundary checks; Italian all-width screenshots plus Chinese/English representative screenshots; final independent QA/Security with no open P0/P1.
- **Risks/blockers:** implementation and exact-SHA release evidence remain outstanding. Integration lease is intentionally deferred until the final candidate is ready to integrate.
- **Next:** assign exactly one Luna application writer with the frozen allowlist; inspect exact diff, then execute focused/full/browser gates and independent final review.

## 2026-09-01T12:00:41Z — Release 2A browser-driven key-isolation Plan Delta

- **Phase:** implementation correction / browser defect isolation.
- **Evidence:** staged console assertions prove baseline page, Quick Actions and Scanner are clean; opening Camera after Scanner produces one React duplicate-key warning for key `0`. Toast cancellation, StrictMode deduplication and stable distinct toast IDs leave one visible Camera toast but do not remove the warning. The mounted MobileWorkspaceDock Scanner and Camera lazy boundaries are siblings and both use loader version `0` as their explicit key.
- **Decision:** allow exactly one additional runtime path, `src/components/mobile-workspace-dock.tsx`, only to prefix attachment/scanner/camera lazy-boundary keys by panel type. Do not change action, state, focus, navigation, draft or retry behavior.
- **Next:** same single writer applies the key-only correction and reruns focused Dock tests plus the exact Scanner→Camera Chromium journey with zero console errors.

## 2026-09-01T12:29:00Z — WebKit global scanner opener defect isolated

- **Phase:** implementation correction / cross-browser focus isolation.
- **Evidence:** after the controlled-sheet close-auto-focus correction, Chromium passes all 45 required stories. WebKit passes 36/45 and fails only the nine desktop global-scanner Escape-focus checks; all mobile, content, layout, credential-leak, mutation-boundary and Order QR stories pass.
- **Diagnosis:** the desktop story opens the Providers-controlled global `ScanSearchSheet` from the AppBar. WebKit does not focus a mouse-clicked button, so ambient `document.activeElement` is not the opener; Chromium's click-focus behavior had hidden that missing explicit relationship.
- **Decision:** add the minimal AppBar-only Plan Delta in `TASK.md`: focus the existing scanner button with `preventScroll` before the unchanged open callback. Do not weaken tests or change Providers/CommandPalette/scanner business behavior.
- **Next:** same single writer applies and proves the one-handler compatibility fix, then the Integration Lead reruns both complete matrices and all static/unit/build gates.

## 2026-09-01T12:51:00Z — Independent final review blocks Camera close and state evidence

- **Phase:** final-review remediation / release remains blocked.
- **Evidence:** final local candidate reached lint/typecheck PASS, Vitest 474 files / 3,192 tests, build 30/30 and Chromium/WebKit 45/45, but both independent reviewers identified missing Camera Escape/outside-dismiss proof and uncontrolled Dock refocus. QA also found frozen image/clipboard/length error states without component-level evidence; Security found the E2E's Sonner pointer-event mutation could mask the real Scanner-to-Camera click and that Camera-owned error toasts were not explicitly dismissed.
- **Decision:** no waiver and no release. Freeze the Camera focus/toast/state-evidence Plan Delta in `TASK.md`, with one minimal new Order Overview photo-trigger propagation path and no business/API/data/config expansion.
- **QA expansion:** the same Plan Delta now includes the sole other direct controlled Scanner caller (`DashboardQuickStart`) and requires actual Camera coverage at 390/430/768/1024/1280/1440 plus one local attachment-draft result journey; the earlier 45-story count is not treated as complete evidence by itself.

## 2026-09-01T13:22:00Z — 768 Camera evidence route corrected

- **Completed:** verified the existing MobileWorkspaceDock is intentionally `md:hidden`, so it cannot be the Camera entry at 768px without changing responsive behavior.
- **Decision:** corrected the frozen evidence route only: Dock remains the existing Camera entry at 390/430; the existing compact Order Detail photo entry proves 768; the existing desktop Order Detail photo entry proves 1024/1280/1440. No layout or business behavior changes are authorized.
- **Next:** the single writer completes the all-locale Camera matrix, real outside-dismiss/focus checks, all-level sensitive console assertions and remaining focused state tests before full gates are rerun.
- **Next:** same single application writer implements the bounded remediation; Integration Lead reruns focused/full/dual-engine gates and requests both reviewers' renewed exact-diff verdict before integration.

## 2026-09-01T13:48:00Z — Release 2A final local gates and visual evidence green

- **Completed:** the single writer closed Camera/Scanner focus, outside-dismiss, toast ownership and state-evidence gaps without changing parser, API, data, permission, payload, dependency or layout behavior. The existing compact Order Detail photo entry proves Camera at 768; Dock remains unchanged and mobile-only.
- **Quality evidence:** Node 22.12 full lint/typecheck PASS, Vitest 474 files / 3,230 tests PASS and production build 30/30 PASS. The four-spec controlled-loopback matrix passes Chromium 46/46 and WebKit 46/46. The final evidence-only animation/toast/clickability collector then passes the dedicated Scanner/Camera spec Chromium 22/22 and WebKit 22/22, with target ESLint/typecheck/focused 111/111 still green.
- **Visual evidence:** 40 sanitized final screenshots under `screenshots/release2a/{chromium,webkit}` cover settled Scanner/Camera surfaces; Camera covers all six widths in Italian and 390/768/1440 in Chinese and English. The final 390/768/1440 samples show complete Sheets, no transition sliver, no toast overlay and reachable bottom actions.
- **Additional controls:** all request mutation lists, page errors and console errors are empty; every console level excludes the protected token and raw `camera unavailable`; Italian/English catalog Han scan is zero; `next-env.d.ts` and diff-check are clean. A React best-practices review found no new waterfall, bundle, hook-dependency, unstable-key or inline-component release blocker.
- **Next:** renew the independent QA and Architecture/Security verdicts against this exact working tree; no P0/P1 may remain before lease, fresh fetch, exact staging, commit and normal main push.

## 2026-09-01T14:02:00Z — Renewed review blocks detached CommandPalette scanner opener

- **Finding:** renewed Architecture/Security review correctly identified CommandPalette as another production opener for the Providers-controlled global Scanner. The CommandItem closes and unmounts before Scanner, so the current ambient opener reference is detached and cannot receive close focus.
- **Decision:** no waiver. Freeze the bounded Providers/AppBar stable-fallback Plan Delta in `TASK.md`: preserve the existing AppBar Scanner button as the accessible focus-return target, sequence focus after CommandPalette closes and before Scanner opens, and change no command/scanner/navigation/business semantics.
- **Scope:** add `src/app/providers.tsx`; reuse the already-approved `src/components/app-bar.tsx`, its test and the existing Scanner E2E. `command-palette.tsx` remains read-only. No API, query, permission, data, dependency, config, layout or parser expansion.
- **Next:** the same single writer implements the state handoff and adds a real Chromium/WebKit CommandPalette → Scanner → Escape proof; then rerun affected gates and both independent final reviews.

## 2026-09-01T14:08:00Z — CommandPalette and Scanner evidence contract completed

- **Clarification:** the stable AppBar Scanner button is the explicit logical return target for both visible-trigger and keyboard-shortcut CommandPalette openings; the removed CommandItem is never treated as a valid opener. Both journeys must prove `focus({ preventScroll: true })`, unchanged scroll and one Scanner instance in Chromium and WebKit.
- **Visual correction:** renewed QA found a fading permission toast in representative Scanner screenshots even though Camera screenshots are clean. The same bounded E2E allowlist must wait for real toast removal and settled Scanner geometry before capture, without DOM/style/pointer mutation. Prior E-027 wording about every screenshot being unobscured is superseded until the corrected final evidence is regenerated and inspected.
- **Next:** same single writer changes only Providers/AppBar/AppBar test and the existing Scanner/Camera E2E; then Integration Lead repeats full Node and dual-engine gates before renewed independent review.

## 2026-09-01T18:27:05Z — Release 2A corrected final local candidate is gate-green

- **Completed:** Providers now sequences CommandPalette closure, next-frame focus on the stable existing AppBar Scanner button with `{ preventScroll: true }`, and unchanged global Scanner opening. AppBar retains an internal ref fallback for all existing callers. `CommandPalette` itself remains unchanged.
- **Direct proof:** visible shell search and keyboard-shortcut CommandPalette openings each prove palette removal, exactly one Scanner, direct Escape return to the stable AppBar Scanner control, unchanged scroll and final `preventScroll: true`; each path is then reopened to prove outside dismissal does not steal focus. Chromium and WebKit both execute these paths.
- **Defense-in-depth:** Camera tests now directly assert stable error-toast dismissal on restart, close and unmount. The E2E request gate allows five verified read-only application POST paths plus the Next development-server `/__nextjs_` namespace; PUT/PATCH/DELETE to those paths fail closed.
- **Final local gates:** Node 22.12 lint PASS; typecheck PASS; Vitest 474 files / 3,231 tests PASS; production build 30/30 PASS; dedicated Scanner/Camera Chromium 22/22 and WebKit 22/22 PASS; complete four-spec Chromium 46/46 and WebKit 46/46 PASS, zero skip/retry/waiver.
- **Visual/data controls:** 40 final PNGs (about 10 MiB) were regenerated under `screenshots/release2a/{chromium,webkit}`. Manual inspection of the previously affected Chromium English 1440, WebKit Italian 768 and WebKit English 1440 Scanner images confirms stable Sheets with no fading toast residue. Protected token/raw camera error/page error/console error/mutation assertions remain active; Italian/English catalog Han scan is zero; `next-env.d.ts` and `git diff --check` are clean.
- **Next:** renew independent QA and Architecture/Security review against this exact working tree. Any P0/P1 blocks integration; otherwise acquire/reverify the integration lease, fresh-fetch, exact stage/commit and normal `main` push.

## 2026-09-01T18:32:43Z — Final review blocks malformed protected Order QR credential

- **Finding:** Architecture/Security identified and Integration Lead confirmed that `parseOrderQrPayload` returns ordinary invalid text with original `raw` for malformed customer-status inputs such as `/r?next=x#<valid-token>`. The shared Scanner result surface therefore renders a valid bearer token and exposes copy affordance. Exact valid links were safe, but the invalid-token-bearing branch violates the same frozen credential boundary.
- **Decision:** no waiver, commit or release. E-028 is now a superseded pre-security-fix snapshot. Freeze the bounded fail-closed Plan Delta in `TASK.md`: Order QR parser plus its unit/wrapper/E2E tests only; empty raw/value and mark sensitive for invalid token-bearing candidates; no shared parser, UI, route, API, permission, data or dependency change.
- **Verification:** include malformed trusted/lookalike/scheme-relative/parser-error/stable-token variants, ordinary invalid regression, and real Chinese/Italian/English Chromium/WebKit DOM/accessibility/clipboard/console non-disclosure. Repeat full Node and complete browser gates, then obtain renewed QA and Architecture/Security P0/P1-zero verdicts.
- **Next:** assign one bounded writer for the four allowlisted paths; inspect exact diff and rerun focused gates before the complete matrices.

## 2026-09-01T19:00:00Z — Dot-suffix credential boundary keeps Release 2A blocked

- **Finding:** after the first fail-closed parser correction, independent QA proved a second representation of the same P1: a parser-error string containing an otherwise valid legacy or stable credential followed by `.trailing` bypassed the delimiter detector, returned ordinary text and would expose Copy.
- **Decision:** the candidate remains NO-GO and the in-flight WebKit full matrix was intentionally stopped; its interrupted result is not release evidence. The same single writer retains only the four frozen Order QR parser/test/E2E paths. No UI, shared customer parser, route, API, payload, permission, data or dependency expansion is allowed.
- **Required proof:** recognize complete stable tokens before legacy boundary matching, preserve the ordinary 44-character lookalike regression, add dot-prefix/dot-suffix unit and real wrapper coverage, and execute at least one strict real-browser dot-suffix non-disclosure journey with zero DOM/attribute/input/a11y/clipboard/console/page-error/navigation/write leakage.
- **Next:** inspect the corrected exact diff and repeat focused tests, full Node/build gates, complete Chromium/WebKit matrices and both independent reviews from the new final tree.

## 2026-09-01T19:56:53Z — Release 2A exact final local candidate gate-green

- **Completed:** legacy and stable customer-status credentials now fail closed even inside malformed URL/parser-error inputs with dot prefix or suffix; valid protected targets keep only the internal destination while ordinary non-sensitive invalid QR values preserve their prior behavior. The global CommandPalette Scanner now passes the existing AppBar Scanner ref as an explicit controlled return-focus target while every other caller retains ambient fallback and outside dismissal never steals focus.
- **Determinism:** the Scanner story waits for the visible styled shell, disappearance of the customer skeleton, the non-pending real list scaffold and its viewport-specific header before opening Radix surfaces. It does not sleep, retry, filter hydration/console errors or weaken assertions. After correction, visible/keyboard stress passes Chromium 20/20 and WebKit 10/10.
- **Final gates:** Node 22.12 lint/typecheck PASS; Vitest 474 files / 3,257 tests PASS; production build 30/30 PASS; complete controlled-loopback Chromium 46/46 and WebKit 46/46 PASS with zero skip/retry/waiver. The previously failing English 1280 keyboard CommandPalette path is green in both full matrices. Order QR malicious journeys pass in Chinese 390, Italian 768 and English 1440 with zero token exposure, mutation, navigation, page error or console error.
- **Scope/evidence:** 40 sanitized Scanner/Camera screenshots remain under `screenshots/release2a/{chromium,webkit}`. `next-env.d.ts` is restored; `git diff --check` passes; package/lock, API/server, schema/migration, dependency/config, shared customer parser, capture parser, scan intent, CommandPalette and IMEI files remain unchanged. One untracked 3.8 MiB Playwright failure-artifact directory was deleted as disposable generated output; no product or evidence file was removed.
- **Next:** obtain renewed independent QA and Architecture/Security P0/P1-zero verdicts on this exact tree, then fresh-fetch, acquire/reverify the integration lease and perform exact staging/commit/push/release gates.

## 2026-09-01T20:10:00Z — Global Scanner credential path supersedes E-029

- **Finding:** final Architecture/Security review found that only the Order QR-specific parser had the new fail-closed detector. The production global `ScanSearchSheet` still delegates to the shared capture parser, where standalone legacy tokens become `serial` and stable/malformed token-bearing inputs can become ordinary `text`; the shared result and resolver can render, copy and create four search actions containing the bearer.
- **Decision:** QA's E-029 local PASS is superseded for release and the milestone remains NO-GO. Freeze the new shared-capture-parser Plan Delta in `TASK.md`; keep the shared customer-status entity parser, IMEI extraction/component, scan intent, routes, API, permission, data and configuration untouched.
- **Required proof:** shared parser, resolver and Scanner component tests plus a real global Scanner Chromium/WebKit malicious journey; valid protected targets keep only the safe internal href, invalid protected values are sensitive/empty/no-action, ordinary identifiers and 44-character lookalikes remain unchanged. Then repeat all gates and both reviews.
- **Next:** assign the same single writer to the bounded capture parser/test/E2E allowlist; do not acquire the integration lease, stage, commit, push or deploy.

## 2026-09-01T20:29:13Z — Shared global Scanner credential boundary is closed

- **Completed:** the shared capture parser now delegates customer-status recognition to the existing entity parser before ordinary order/identifier/text classification. Valid legacy/stable or trusted-link credentials retain only the normalized internal `/r#...` destination; invalid, parser-error, wrong-path, query/fragment, order-prefix and dot-boundary credential candidates are sensitive with empty raw/value and no resolver action.
- **Compatibility proof:** ordinary 44-character lookalikes, UUID orders and IMEI/SN/EID/EAN/SKU inputs retain prior classification. The shared customer-status entity parser, IMEI extraction/component, scan-intent, CommandPalette, API/server, schema/migration, package/lock and deployment configuration remain unchanged.
- **Final local gates:** Node 22.12 lint/typecheck PASS; Vitest 474 files / 3,276 tests PASS; production build 30/30 PASS; corrected focused 7 files / 132 tests PASS; global malicious Scanner Chromium 3/3 and WebKit 3/3 PASS; complete four-spec Chromium 46/46 and WebKit 46/46 PASS. The existing deterministic CommandPalette focus stress remains Chromium 20/20 and WebKit 10/10 because no focus-source file changed afterward.
- **Evidence controls:** the E2E request classifier accepts GET/HEAD/OPTIONS, five verified read-only application POST routes and the Next development-server `/__nextjs_` namespace; unknown methods fail closed. Forty sanitized Scanner/Camera screenshots remain tracked under `screenshots/release2a/{chromium,webkit}`. `next-env.d.ts` is restored and exact diff/forbidden-boundary checks pass.
- **Next:** renew independent QA and Architecture/Security review against this exact E-030 working tree. Any P0/P1 blocks lease, integration and release.

## 2026-09-01T20:37:00Z — E-030 independent final reviews pass

- **Verdicts:** QA PASS and Architecture/Security PASS on the exact E-030 source/test tree; P0 = 0 and P1 = 0. QA independently passed 7 files / 131 tests and visually reviewed all 40 PNGs. Architecture/Security independently passed lint/typecheck, 7 files / 135 tests and an expanded malicious/compatibility probe.
- **Confirmed closure:** both reviewers independently confirmed entity-parser-first protection in the shared Scanner, fail-closed malformed/standalone/dot-boundary credentials, valid safe internal targets only, ordinary identifier compatibility, Order QR parity and unchanged API/data/permission/config boundaries.
- **P2 follow-up:** `main` has no platform-required checks and therefore needs manual exact-SHA enforcement; the test-only Next development namespace remains an explicit POST exception; shared and Order QR containment helpers may drift and should be consolidated only through a later entity-layer contract. These are not current production P0/P1 defects and do not authorize scope expansion now.
- **Next:** fresh-fetch, acquire and verify the project integration lease, exact-stage the reviewed candidate, commit and normal-push `main`; then require same-SHA hosted verify/Chromium/WebKit, READY production deployment, public read-only smoke and a fresh rollback anchor.

## 2026-09-01T20:56:24Z — Hosted WebKit fails closed on per-case capacity

- **Published candidate:** commit `e2487b15ed72b775b95034f82aca4c5bc3989f78` was normally pushed to `main`. GitHub run `33556608348` passed verify and Chromium 46/46, while WebKit passed 38/46 and failed eight matrix cases at the unchanged 30-second per-test ceiling. No retry, waiver or manual green claim was used.
- **Artifact diagnosis:** downloaded `i18n-webkit` to `/private/tmp/repairdesk-ci-33556608348-webkit`. Failed cases lasted 30.9–31.6 seconds; the same hosted journey took about 20–30 seconds when it passed. Screenshots show the expected localized Camera Sheet and safe permission state. Late assertions were natural toast disappearance, geometry settlement, close completion or trial action stability, all reached after most of the same test had already passed.
- **Decision:** freeze a test-only Plan Delta: give only the generated 18 Scanner/Camera matrix cases a 60-second total budget. Do not change expectation timeouts, assertions, wait logic, retries, skips, application source, workflow command or job timeout. Any failure inside that budget is an underlying defect and blocks further timeout changes.
- **Production state:** auto-deployment `dpl_CNYvuWkYM3mTonJgPTHu1TBkDtez` is READY at exact SHA `e2487b15...`; apex/www/login/Kiosk/`/r`/offline and three employee login SSR locales pass public read-only smoke. It is not formally accepted while hosted WebKit is red. Immediate prior READY rollback anchor remains `dpl_F8qQS27LxRAHVw3a7m3Dg9FBFPqq` at `7d1b59c5...`.
- **Next:** one bounded test writer applies the timeout line, proves both local engines without retry/skip/waiver, then renewed QA and Architecture/Security review the exact corrective tree before a new commit/push.

## 2026-09-01T21:07:38Z — Test-only hosted-capacity correction is locally green

- **Exact diff:** the generated 18-case Scanner/Camera callback adds only `test.setTimeout(60_000)`. No expectation timeout, assertion, action, helper, retry/skip/only policy, application source, CI workflow or job timeout changed.
- **Local proof:** full Scanner/Camera spec passes Chromium 22/22 in 4.1 minutes and WebKit 22/22 in 4.2 minutes under `workers=1`, `--forbid-only` and `--fail-on-flaky-tests`, with no retry or waiver. Target ESLint, full typecheck, target Prettier and diff-check pass.
- **Generated file:** both dev-server runs changed `next-env.d.ts`; Integration Lead restored the committed `.next/types/routes.d.ts` baseline and confirmed it is clean.
- **Next:** renew QA and Architecture/Security against this exact four-path corrective tree. P0/P1 must remain zero, then fresh-fetch, reverify/renew the integration lease, exact-stage, create a separate normal corrective commit and push.

## 2026-09-01T21:16:16Z — Corrective independent reviews pass

- **Verdicts:** QA PASS and Architecture/Security PASS on the exact corrective tree; P0 = 0, P1 = 0 and new P2 = 0. Existing E-031 governance P2s remain unchanged.
- **Integrity proof:** both reviewers verified that deleting the single 60-second timeout line makes the spec byte-identical to `origin/main=e2487b15...`; only the generated 18 cases are affected, while all expectation timeouts, assertions, actions, helpers, request gates, retry/skip/only policy, application source, CI command and 30-minute job ceiling remain unchanged.
- **Artifact proof:** all eight hosted failures were 30,907–31,636ms with `testTimeout=30000`, and downloaded traces/screenshots show safe localized Camera permission surfaces and late assertion truncation, not raw errors, credentials, production traffic, authorization headers or mutations.
- **Next:** fresh-fetch, verify the active integration lease, exact-stage only the three Task Memory files and one E2E test, create a separate normal corrective commit and push. Formal production remains NO-GO until that new SHA passes hosted verify/Chromium/WebKit and a same-SHA READY deployment plus read-only smoke.
