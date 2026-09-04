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

## 2026-09-01T21:36:12Z — Release 2A exact-SHA production milestone accepted

- **Integrated:** corrective commit `5edab21d75c540cd16b32e87683edb1d72a7a5dd` is `HEAD = origin/main`. It follows feature commit `e2487b15ed72b775b95034f82aca4c5bc3989f78`; the corrective delta changes only the generated Scanner/Camera matrix total-test budget plus Task Memory.
- **Hosted gate:** GitHub Actions run `33560282833` is fully SUCCESS: verify passed lint/typecheck, Vitest 474 files / 3,276 tests and build 30/30; Chromium and WebKit each passed 46/46 with zero retry, skip, flaky acceptance or waiver.
- **Production:** Vercel deployment `dpl_6eEWtvZQAGw1JSkXeX9gDAuyuUdp` is READY at the exact final SHA on `www.chinatech.in` and `chinatech.in`. Public read-only smoke confirms expected root/login/Kiosk/`/r`/offline routing, all three employee login SSR locales, and fixed Italian isolation for Kiosk and `/r`. The 30-minute error-level and 5xx log queries returned zero entries.
- **Evidence and rollback:** 40 sanitized Chromium/WebKit screenshots remain tracked under `screenshots/release2a/`. Immediate previous READY is `dpl_CNYvuWkYM3mTonJgPTHu1TBkDtez`; the last fully accepted rollback anchor is `dpl_F8qQS27LxRAHVw3a7m3Dg9FBFPqq` at Release 1 SHA `7d1b59c5...`.
- **Status:** Release 2A is complete. The parent task remains active for Release 2B and Release 3; no claim is made that all remaining employee fixed UI is translated.

## 2026-09-02T04:01:27Z — Release 2B-1 Orders New + Task contract frozen

- **Goal:** execute the approved Release 2B sequence, with only 2B-1 active in the current bounded packet.
- **Baseline:** `HEAD = origin/main = 5edab21d75c540cd16b32e87683edb1d72a7a5dd`; only the three Integration Lead Task Memory files are dirty. Node 22.12 focused baseline passed 12 files / 94 tests; independent QA passed 15 files / 73 tests and diff-check.
- **Reviews:** Product, code-boundary and QA read-only reviews converged on a 20-consumer presentation allowlist, frozen API/payload/permission/data/print/warranty/scanner boundaries and a 72-point three-locale/six-width/dual-engine core matrix.
- **Known release blockers:** the two screens still contain fixed Chinese, New Order formats draft time with fixed `zh-CN`, raw error text reaches employee UI at several presentation boundaries, the required screen i18n tests/E2E/CI inclusion do not yet exist, and no 2B-1 screenshots or independent final verdicts exist.
- **Next:** assign one bounded application writer. Task Memory, staging, commit, push, deployment and production remain Integration Lead-only; no final release occurs until all planned batches and final gates complete.

## 2026-09-02T07:03:00Z — Release 2B-1 first Chromium gate fails closed

- **Result:** 14/18 PASS; all three 768px cases failed because the test required a close button that the responsive dialog does not render at `md`, and one Chinese 1440px case hit the unchanged 60-second total test budget during Task navigation. No retry or waiver was used.
- **Real UI finding:** the 768 Italian accessibility snapshot proved that `new-order-dialog.tsx` hidden title/description/loading chrome and repair category/ARIA display labels remained Chinese. Dynamic/canonical repair item values, persisted warranty text and excluded IMEI Scanner copy remain distinct.
- **Decision:** freeze the minimal first-browser Plan Delta in `TASK.md`; localize the missed Dialog chrome and stable-key repair-category presentation, correct the viewport-aware assertion, preserve every payload/data/layout boundary, then rerun the full matrices. The isolated timeout must be diagnosed only if it recurs after correction.

## 2026-09-02T08:49:36Z — Release 2B-1 independent review blocks closure

- **Green evidence retained:** Node 22.12 lint/typecheck PASS; Vitest 479 files / 3,295 tests PASS; build 30/30 PASS; default Chromium and WebKit each 18/18 PASS. Forty-eight sanitized screenshots are stored under `screenshots/release2b1/{chromium,webkit}`. The expanded audit now reports 7,651 occurrences / 5,420 unique, down 426 / 266 from E-036.
- **P1 blockers:** both independent reviewers identify (1) Chinese display-string-driven Task guidance localization instead of stable ID/code selection and (2) absent frozen-contract runtime proof for three-locale mutation deep equality, create/quote idempotency and heavy-state/in-place locale-switch preservation. P0 remains zero.
- **Decision:** no integration, commit, push or deploy. The remediation Delta extends only the stable guidance model/test and bounded screen/E2E evidence paths, preserves every API/payload/permission/customer/print/warranty/scanner boundary, and forbids skip/retry/timeout/error-filter waivers.
- **Next:** assign one bounded remediation writer, then repeat focused/full/dual-engine gates and renew both independent reviews before 2B-1 can close.

## 2026-09-02T12:02:00Z — Release 2B-1 renewed QA requires explicit state assertions

- **Closed:** stable `guidanceCode` classification, three-locale Create/Transition/Patch/Quote/Kiosk payload equality, Create timeout status confirmation, Quote retry idempotency, and the three dual-engine heavy journeys now have valid dynamic evidence. Main-thread Node 22 gates and Chromium/WebKit 21/21 pass.
- **Review split:** Architecture/Security PASS with P0 0 / P1 0; QA FAIL with P0 0 / P1 1 because some required state labels are represented by setup or test names rather than concrete localized runtime assertions.
- **Decision:** freeze a test-only evidence-completion Delta. Do not change production source or weaken browser readiness/errors/retry policy. No integration, commit, push or deployment.
- **Next:** the same bounded writer adds the exact New Order and Task state assertions, repeats all gates, and both independent reviewers re-evaluate the final tree.

## 2026-09-02T12:41:00Z — Release 2B-1 Orders New + Task passes locally

- **Acceptance:** stable guidance semantics, all three-locale mutation bodies, Create/Quote idempotency, full New Order/Task state assertions, responsive core matrix and heavy in-place language-switch journeys are complete.
- **Final gates:** Node 22.12 lint/typecheck PASS; Vitest 479 files / 3,381 tests PASS; build 30/30; Chromium 21/21 and WebKit 21/21 with zero retry/skip/flaky acceptance. The diagnosis-error async assertion race is fixed and passed nine independent cold runs across writer, main and QA.
- **Independent verdicts:** QA PASS and Architecture/Security PASS, each P0 0 / P1 0. Three non-blocking P2 follow-ups remain registered for later governance.
- **Release posture:** no stage, commit, push or deployment. Release 2B-1 is a completed local milestone inside the still-active parent goal.
- **Next:** execute the approved sequence at Release 2B-2 Order Detail, beginning with a fresh bounded residual/consumer audit and frozen contract.

## 2026-09-02T13:20:00Z — Release 2B-2 Order Detail contract frozen

- **Scope:** direct and workspace Order Detail employee surfaces are split internally into core/safe-error/date presentation and nested workflow/dynamic evidence; Customers remain blocked until both close.
- **Baseline findings:** 732 Han-bearing candidate lines in the reachable employee tree; active raw API/provider/storage error exposure; hard-coded or default-wrong locale formatting; no dedicated tri-locale detail suite or 36-case dual-engine gate. P0 is zero; current pre-implementation QA is P1 six and Security is P1 one.
- **Frozen boundaries:** dynamic/customer/custom/history values, canonical payment/audit/reason fields, notification/customer body, warranty, print/PDF/customer-status, Scanner/Camera/IMEI, API/server/query/cache/permission/schema/dependency all remain unchanged. Stable code/status presentation adapters and safe generic unknown errors are required.
- **Idempotency stop:** the audit records pre-existing new-UUID retry behavior and approval's missing caller idempotency surface. Translation may not redesign it silently; any API/type/repository/schema need requires a separate Owner decision and blocks final 2B-2 closure.
- **Next:** assign one bounded 2B-2A writer to the core presentation/safe-error/date allowlist, then run focused evidence and an independent review before 2B-2B.

## 2026-09-02T14:20:00Z — Release 2B-2A review fails closed

- **Green slice evidence:** stable adapters and safe error mapping, locale-aware Europe/Rome dates, core child localization and basic tri-locale mutation inputs pass 37 focused tests plus typecheck/lint/Prettier/diff-check.
- **Review blockers:** supplier badges drop the dynamic supplier name; event presentation drops historical reason/amount/status-change or money formatting; IMEI entry copy crossed the frozen Scanner boundary; compact/core conflict and validation copy plus partial-save/rejection paths lack complete evidence.
- **Decision:** no 2B-2B yet. Freeze the exact remediation Delta, revert Scanner copy, preserve every dynamic payload field, complete only core/mobile/no-store display overrides and safe rejection containment, then re-review.
- **Next:** same single writer executes the expanded-but-bounded remediation allowlist. No API/type/server/query/cache/idempotency or customer/print/warranty/scanner semantics may change.

## 2026-09-02T15:35:00Z — Release 2B-2A core slice passes

- **Corrected:** supplier names and all historical reason/amount/status/payment/warranty fields remain exact; IMEI entry copy is back at baseline; compact/desktop/no-store/conflict/validation/partial-save and clipboard/IMEI rejection paths are safe and localized.
- **Evidence:** Node 22 remediation 67/67, 2B-1 regression 145/145, additional detail 13/13, warranty whitespace sentinel 15/15, plus lint/typecheck/Prettier/diff-check.
- **Reviews:** QA PASS P0 0/P1 0 (one invalid-date/DST P2 retained); Architecture/Security PASS P0 0/P1 0/P2 0.
- **Next:** activate 2B-2B nested Order Detail workflows and final browser/dynamic evidence. No partial commit/push/deploy.

## 2026-09-02T17:40:00Z — Release 2B-2B focused review blocks browser gate

- **Current green evidence:** nested catalog/components pass 93 focused tests and prior-batch regressions pass 163 tests under Node 22, but this does not cover the real rejected-Promise and permission paths.
- **P1 blockers:** Cancel/Approval/Attachment can reject unhandled; Notify message body no longer follows baseline trim; cost-source unknown values are mislabelled; one unlock label remains Chinese; terminal/cost/parts/capability mutation evidence is incomplete.
- **Decision:** freeze the pre-browser remediation Delta. Include only bounded UI rejection containment, baseline payload restoration, stable source mapping, the missed label, complete runtime evidence and safe NavigationGuard diagnostic cleanup.
- **Next:** same single writer corrects and proves these paths; no browser matrix until both independent reviews return P0/P1 zero.

## 2026-09-02T18:18:00Z — Release 2B-2B renewed review corrects attachment evidence and finds photo gate

- **QA correction:** the real frozen `CameraCaptureSheet` clears and closes immediately after its synchronous `onCapture` callback. The earlier attachment test mock did not reproduce that lifecycle, so its open-state assertion was invalid. Order Detail must consume asynchronous upload failure and expose only a safe localized error while preserving the existing close/clear/object-URL-revoke behavior; Camera/capture source remains unchanged.
- **Security blocker:** desktop and compact/mobile photo entries are currently gated only by record state, while the server independently enforces `order:photo_upload`. A viewer/no-capability fixture can therefore see an action that will be rejected. Both entries need a fail-closed existing-capability gate plus a real no-trigger/no-request test, or an explicit Owner-approved API projection Delta if no exact existing capability exists.
- **Next:** obtain the independent verdict on the existing projected capability, then give the same single writer only the corrected attachment test and photo-affordance gate. Browser work remains blocked.

## 2026-09-02T18:30:00Z — Release 2B-2B non-API remediation passes; Owner capability decision required

- **Closed:** async customer-pick closes only after success and preserves list/search on rejection; attachment evidence now mirrors Camera's real synchronous capture then close/clear behavior; supplier and assignee exact IDs/payloads pass in all locales; owner/manager/assigned and unassigned technician/sales/viewer existing-capability zero-request evidence passes; direct parts-release rejection is safe and canonical.
- **Evidence:** main Node 22 focused suite 19 files / 167 tests PASS, full lint/typecheck, target Prettier and diff-check PASS. Renewed independent QA PASS P0 0/P1 0/P2 0 for this non-API packet.
- **Security stop:** independent Security rejects use of edit, correct or Kiosk capability as a proxy for `order:photo_upload`. The server is secure, but a viewer still sees an action that will be rejected. The minimal optional `canUploadPhoto` server projection, mock parity, three UI gates and role tests are recorded in `TASK.md` as proposed-only.
- **Next:** request explicit Owner approval for that API/type/repository Plan Delta. Until approved, no browser matrix, later domain batch, staging, commit, push or deploy.

## 2026-09-02T18:36:00Z — Photo-capability read-only baseline verified

- **Evidence:** Node 22 repository projection, mock provider, router permission and permission-matrix suites pass 4 files / 196 tests.
- **Exact behavior:** `order:photo_upload` is owner/manager/sales allow, technician scoped and viewer deny; the upload route already enforces it. Existing UI permits photos on terminal non-void orders, so the optional projection must not inherit routine-edit restrictions and must preserve terminal behavior while failing closed for voided or denied actors.
- **Boundary:** this was read-only verification. No API/type/repository/UI implementation was made; Owner approval remains required.

## 2026-09-02T18:45:00Z — Order Detail idempotency axis becomes documented P2

- **Verdict:** renewed independent Architecture/Security review returns PASS with P0 0/P1 0/P2 1 for the registered transition/cancelled-return/custody/approval retry limitation.
- **Decision:** preserve the Owner-mandated API/query/payload boundary. Prove locale-invariant canonical inputs and no idempotency-field drift; do not claim UUID-normalized equality is same-key replay. Record the existing lost-response limitation as P2 and leave true recovery redesign to a future Owner-approved project.
- **Release posture:** no additional authorization is needed for this idempotency axis. Only the photo-upload capability P1 still blocks 2B-2 browser work.

## 2026-09-02T19:00:00Z — Owner authorizes exact photo-upload capability Plan Delta

- **Authorization:** Owner replied “确认” to the proposed minimal optional `canUploadPhoto` projection, its mock parity, desktop/compact/Sheet fail-closed gates and exact role tests.
- **Boundaries:** permission matrix, upload endpoint/body, attachment storage/read projection, Camera/capture source, query/cache, schema/migration, dependencies and customer outputs remain unchanged.
- **Next:** the existing single application writer implements the exact allowlist, runs Node 22 focused gates, then independent QA and Security must return P0/P1 zero before browser work.

## 2026-09-02T19:35:00Z — Exact photo capability passes; Order Detail browser packet active

- **Implementation:** optional `canUploadPhoto` is projected solely from the scoped server `order:photo_upload` decision and non-void state; mock parity and every desktop/compact/Sheet affordance use exact-true fail-closed gating. Permission matrix, endpoint/body and Camera/capture remain unchanged.
- **Evidence:** main Node 22 capability/E-044 suite 5 files / 211 tests, typecheck, target lint and frozen-boundary diff pass. Independent QA and Security both PASS with patch P0 0/P1 0/P2 0; cumulative Order Detail retains only the documented pre-existing idempotency P2.
- **Next:** same single writer adds the exact 24-case-per-engine Order Detail E2E plus CI inclusion. Integration Lead owns dual-engine execution, screenshots, full gates and final review. No partial commit/push/deploy.

## 2026-09-02T20:05:00Z — Order Detail heavy-browser evidence corrected to real UI states

- **Finding:** the existing action dock disables flow while finance editing is active, and modal focus trapping correctly prevents using the external AppBar language control. A simultaneous draft + modal/pending language-switch assertion would therefore be synthetic rather than user-reachable.
- **Decision:** keep production code frozen and prove the 1440 heavy journey in two sequential phases: real edit-draft preservation across `en → it → en`, followed by one real inline transition request held pending across the same switch. Observe exactly one request and compare its unchanged canonical body and caller-owned UUID without describing it as a retry.
- **Next:** the same browser writer may add only the approved E2E and exact CI inclusion. No application behavior, retry/skip/timeout policy or assertion weakening is authorized.

## 2026-09-02T20:35:00Z — First Order Detail Chromium run fails closed and narrows correction

- **Evidence:** Node 22 Prettier/target ESLint and Chromium list pass with exactly 24 tests; the first full Chromium run returns 4/24 pass and 20 fail.
- **Product defect:** the existing custody card omits the already-available localized label prop on `DeviceCustodyBadge`, leaking stable enum label `门店保管` in Italian/English while its adjacent description is localized.
- **Harness defects:** compact layout, workspace records view, edit-mode customer rendering and dynamic-Han classification asserted shapes that the real UI does not promise. Canonical warranty/history and registered synthetic dynamic text remain intentionally untranslated.
- **Next:** same single writer applies the one-call-site label correction plus focused proof and repairs only the E2E harness. Chromium must reach 24/24 before WebKit. No commit, push or deploy.

## 2026-09-02T21:05:00Z — Chromium passes; WebKit identifies exact static-read allowlist gap

- **Closed:** localized custody badge runtime proof passes 63/63 focused tests; target lint/typecheck/Prettier/diff pass; corrected Chromium matrix passes 24/24 with 24 synthetic screenshots.
- **WebKit evidence:** all 24 stories reach the final strict request check and fail only on two same-origin static GETs, `/manifest.webmanifest` and `/__nextjs_font/geist-latin.woff2`. No product, mutation, locale, console or page-error failure is reported.
- **Decision:** add only those two exact loopback read paths. Prefix/wildcard, external traffic, APIs and writes remain fail-closed. Then rerun both engines; no commit, push or deploy.

## 2026-09-02T21:30:00Z — Dual-engine green evidence fails independent visual acceptance

- **Engine evidence:** after exact static-read correction, Chromium and WebKit both pass 24/24 and provide 48 synthetic screenshots.
- **QA/UX verdict:** FAIL, P0 0/P1 3. Compact fixed-width detail labels overlap values; the device-section title collapses under two actions at 390/430; stable approval enum `not_required` leaks into Italian/English UI. Fixed-dock end-of-content geometry is also unproven (P2 evidence gap).
- **Decision:** freeze the minimal responsive/stable-enum remediation in `TASK.md`. Add bounding geometry and end-scroll evidence, regenerate both matrices, then renew independent review. No commit, push or deploy.

## 2026-09-02T22:05:00Z — Visual remediation passes browsers; full Vitest exposes unrelated UUID flake

- **Closed:** focused 81/81, target static gates, Chromium 24/24 and WebKit 24/24 pass after the three visual P1 corrections and dock geometry evidence; 48 screenshots regenerated and representative views inspected.
- **Full gate:** lint/typecheck pass. Vitest returns 490/491 files and 3525/3526 tests because a whole-response `not.toContain("999")` assertion matched random UUID digits. Immediate isolated rerun passes.
- **Decision:** replace only that brittle numeric substring test with explicit sensitive finance-field absence assertions; production AI behavior remains frozen. Then rerun the full suite and build before final review.

## 2026-09-02T22:20:00Z — QA passes; Security catches path-only write allowlist

- **Full gates:** corrected full Vitest passes 491/491 files and 3526/3526 tests; production build passes 30/30. Final QA/UX returns PASS P0 0/P1 0/P2 1 existing.
- **Security blocker:** E2E allowed writes compare only method/path and do not re-check exact origin/loopback, so a same-path external POST could be incorrectly allowed and counted as local evidence.
- **Decision:** test-only exact-origin correction plus synthetic `.invalid` negative probes inside the two existing allowed-write heavy journeys. Keep 24 cases per engine and every other request fail-closed; renew both engines and Security. No commit, push or deploy.
- **Additional evidence gap:** the frozen acceptance names three-locale `cancelled-return` runtime input equality, but current screen tests cover transition/custody only. Add a test-only production-callback capture with one call per locale and UUID syntax/normalization, preserving the documented lost-response P2 and making no retry claim.

## 2026-09-02T21:38:00+02:00 — Order Detail final closure; Customers audit active

- **Security corrections:** strict browser writes require exact origin, loopback, method and path; synthetic same-path external probes are aborted and separately evidenced. Cancelled-return now has real tri-locale one-call canonical-input proof with valid UUIDs normalized only for comparison.
- **Final gates:** Chromium 24/24, WebKit 24/24, 48 sanitized screenshots, Node 22 lint/typecheck PASS, Vitest 491/491 files and 3527/3527 tests PASS, production build 30/30. Final QA PASS P0 0/P1 0; renewed Security PASS P0 0/P1 0/P2 1 existing.
- **Decision:** Release 2B-2 is locally closed. Release 2B-3 Customers begins with read-only audit and contract freezing; no partial commit/push/deploy.

## 2026-09-02T22:05:00+02:00 — Customers baseline and bounded contract frozen

- **Audit:** four independent read-only views mapped `/customers`, direct/preview detail and the Customers-owned component/form tree. Approximately 384 Han-bearing production lines remain classification candidates; only fixed employee presentation may be localized.
- **Baseline:** Node 22 Customers/server and authorization/tenant suites pass 15 files / 136 tests. Current P0 is zero. Blocking P1 classes are incomplete tri-locale presentation, five unhandled mutation rejection boundaries, absent canonical/locale-switch runtime proof and absent strict dual-engine evidence.
- **Permission resolution:** one bounded cross-review accepts the missing exact customer capability projection as cumulative P2 because server authorization is fail-closed and the parent objective freezes API/types/permissions. 2B-3 will not change or claim UI permission affordance closure; a future capability projection requires Owner Plan Delta.
- **Decision:** frozen staged contract 2B-3A list/model, 2B-3B detail/forms, 2B-3C browser/CI. One writer at a time; no partial commit/push/deploy.

## 2026-09-02T22:18:00+02:00 — Shared compact-list text slots authorized

- **Finding:** real Customers compact search renders four fixed Chinese strings inside `RepairOsListScaffold`; the caller cannot localize them without replacing the established interaction.
- **Decision:** allow only optional presentation props plus direct compatibility tests in `repair-os-mobile.tsx`; defaults and all existing callers remain unchanged. This is a frontend compatibility Delta, not an API/permission/layout change.

## 2026-09-02T22:27:00+02:00 — Customers 2B-3A list slice passes; detail/forms activated

- **Implemented:** tri-locale customer list/filter/card/table/status/loading/empty/stale/fatal/redacted/pagination/create-shell presentation, stable code/kind adapters and Europe/Rome locale dates. Dynamic/custom data, canonical filters/hrefs/create inputs and intents remain exact.
- **Correction:** independent Security identified an unauthorized `SidebarTrigger`/`mobileLeading` navigation addition. Integration Lead removed it; screen tests 14/14, target ESLint and Prettier passed after correction. Renewed Security then passed.
- **Final slice gates:** main Node 22 focused 9 files / 74 tests PASS; typecheck, target ESLint, Prettier and waiver scan PASS. Independent QA PASS P0 0/P1 0/P2 1; Security PASS P0 0/P1 0/P2 2. The P2 ledger is compatibility/evidence/capability only and is not represented as closed.
- **Decision:** 2B-3A locally closes. 2B-3B Customers detail/forms is active under the frozen presentation-only allowlist. Browser/screenshots remain deferred to 2B-3C; no stage, commit, push or deployment.

## 2026-09-02T23:20:00+02:00 — Customers 2B-3B detail/forms passes; browser packet activated

- **Implemented:** tri-locale fixed employee presentation across direct/preview detail, hero/tabs/panels/profile/device Sheet and all Customer forms. Dynamic/history/custom/warranty/tag/customer values, fixed Italian message output and the persisted Chinese follow-up default remain exact.
- **Corrected before closure:** Integration Lead caught and closed the 768 duplicate Customer/AppBar header and canonical `done` mapping defects. QA then required real tri-locale Customer create identity/conflict/error/rejection/intent evidence and removal of a delete-call fallback; both were added test-only.
- **Final evidence:** main Node 22 focused 17 files / 123 tests PASS; typecheck, target ESLint, Prettier, diff-check and waiver scan PASS. QA PASS P0 0/P1 0/P2 1. Security PASS P0 0/P1 0, cumulative P2 4, new P2 0.
- **Decision:** 2B-3B locally closes. Activate only 2B-3C E2E/CI/sanitized screenshot evidence. Production source is frozen absent a separately recorded browser remediation. No partial commit/push/deploy.

## 2026-09-02T23:45:00+02:00 — First Customers Chromium gate fails closed on untranslated status badge

- **Result:** all 24 stories executed; 19 pass and five fail. Italian 768 and English 1440 prove that Customer order/device cards still render shared Chinese `已完成` for canonical `completed` because their `StatusBadge` calls omit a localized label.
- **Classification:** this is a real Customer presentation P1 and may not be added to the Han allowlist. Three remaining failures are harness-only: expected 500 responses create a browser resource-console error, and one Escape focus assertion requires a relationship Radix does not promise.
- **Decision:** authorize the minimum Customer-only status-label call-site correction plus direct tests and the two exact harness corrections. Shared badge/status model, payloads, routes and all other production files remain frozen. No WebKit, integration, commit, push or deploy until corrected Chromium is 24/24.

## 2026-09-03T00:05:00+02:00 — Corrected Chromium passes; first WebKit exposes hydration and focus races

- **Chromium:** fresh corrected run passes 24/24 in 26.7 seconds with 24 new screenshots. All five Customer-owned status badges now receive stable localized labels; actual tri-locale status rendering passes 15/15.
- **WebKit:** complete run passes 21/24. The failures are one real SSR/client initial-state hydration mismatch, one real controlled follow-up Dialog focus-return gap, and one strict-gate false positive for a same-origin browser-local `blob:` GET. The English detail case passes 1/1 on a fresh isolated server, proving nondeterministic timing but not authorizing an error waiver.
- **Decision:** freeze the minimum Customer-only hydration guard and exact opener restoration plus a protocol+origin+read-method blob gate correction. Shared Dialog, AppBar, store shell, query/API behavior and error collection remain unchanged. Both complete engines must pass again before closure.

## 2026-09-03T00:25:00+02:00 — WebKit remediation diagnostics pass; Chromium finds Device Dialog focus gap

- **Closed diagnostically:** the original WebKit failure set is now 3/3; detail hydration, follow-up exact opener focus and same-origin read-only blob handling pass. Focused Node 17/17 and static gates pass.
- **Fresh Chromium:** 23/24. The remaining English desktop preview case closes a real controlled Device Dialog onto a hidden Radix focus guard, not the invoking edit button.
- **Decision:** treat this as a new Customer a11y P1 and authorize the same actual-opener/onCloseAutoFocus pattern only through the device Customer chain. No Tab fallback, assertion weakening, shared primitive change, WebKit full run, commit, push or deploy.

## 2026-09-03T00:20:00Z — Full gates pass; independent QA finds tablet tab-navigation P1

- **Nominal evidence:** the final controlled-Dialog remediation passes focused Node tests, Chromium 24/24 and WebKit 24/24 with 48 screenshots. Main-thread focused Customers tests pass 11 files / 116 tests; lint and typecheck pass; full Vitest passes 500 files / 3624 tests; production build passes 30/30.
- **QA stop:** direct Customer detail at `768–1023` has no visible tab strip because the mobile header is hidden from `md` while the main tabs remain `lg`-only. The 768 screenshots confirm only Overview content plus bottom actions, and the E2E omitted a five-tab reachability assertion for that branch.
- **Decision:** record and execute the minimum Customer-screen/tablet E2E remediation in `TASK.md`. Release 2B-3 remains open and 2B-4, commit, push and deploy remain blocked until fresh dual-engine evidence and renewed independent QA/Security pass.

## 2026-09-03T00:30:00Z — Independent Security finds device-history status-label P1

- **Finding:** `DeviceHistoryRow` in the reachable Customer device Sheet still omits the existing stable localized label for the shared status badge. Italian/English employees therefore see fixed Chinese canonical history status labels when the device has orders; previous direct tests used an empty history and the browser journey edited the child control without opening the Sheet.
- **Decision:** freeze the Customer-Sheet-only label-prop and real tri-locale/history-browser coverage Delta in `TASK.md`. No shared badge/status, API/query/payload, route, permission, commit, push or deployment change is authorized.

## 2026-09-03T00:40:00Z — Customers 2B-3 closes; Inventory 2B-4 audit begins

- **Closed:** the final tablet-tab and Device Sheet status remediations pass focused 39/39, full lint/typecheck, Vitest 500 files / 3636 tests, build 30/30, Chromium 24/24 and WebKit 24/24 with 48 sanitized screenshots. Main and independent visual inspection confirm one AppBar, one five-tab strip and localized `Chiuso`/`Closed` at the 768/history paths.
- **Review:** final QA and Security both PASS with P0 0/P1 0. Four pre-existing Customer P2s remain registered: exact UI capability projection, lost-response idempotency, follow-up local/UTC semantics and shared list-scaffold default pending text edge.
- **Next:** Release 2B-4 begins read-only Inventory Products/Lifecycle audit under the existing responsive, Floating Card, Quick Entry and production-data stop contracts. No Inventory write, partial commit, push or deployment yet.
## 2026-09-03 — Release 2B-4 Inventory audit complete / contract frozen

- Four independent read-only audits and Node 22 focused baselines confirm that Inventory route metadata is localized but all ten production Products/Lifecycle employee surfaces still lack runtime locale integration.
- Frozen ordered work is 2B-4A adapters, 2B-4B read-only Products, 2B-4C Quick Entry and its already-authorized disclosure/evidence gaps, 2B-4D Lifecycle, then 2B-4E strict dual-engine browser/CI/review.
- Current newer Style C shelf remains the product baseline; the contradictory older dense-list statement is scheduled for documentation sync rather than silently redesigning the UI during translation.
- Security discovered one separate two-file edit-data raw-provider-error remediation. UI work can proceed, but 2B-4 closure remains blocked until the Owner explicitly confirms that API failure-status correction and review closes it.
- No Inventory source, commit, push or deployment has occurred at this checkpoint.

## 2026-09-03 — Release 2B-4A first review blocks on two presentation-fidelity P1s

- Initial adapters/messages pass Node 22 focused 38/38, typecheck, lint, Prettier and diff checks; Architecture/Security first found no boundary expansion.
- Independent QA proves unknown ledger events retain a fixed Chinese generic label in Italian/English and the receipt adapter erases eleven command-specific employee confirmation semantics. A bounded cross-review agrees both are P1.
- A three-file remediation is frozen in `TASK.md`; no screen, API, payload, server, catalog, commit, push or deployment change is authorized by it.

## 2026-09-03 — Release 2B-4A renewed QA catches future-command crash

- The original unknown-event and command-specific receipt defects are corrected and Security passes the remediation, but renewed QA directly reproduces a `TypeError` when the existing forward-compatible receipt resolver returns a future command not present in the known map.
- A two-file maximum correction is frozen: safe localized generic receipt copy for unknown commands plus three-locale confirmed/replay no-throw evidence. 2B-4A remains open.

## 2026-09-03 — Release 2B-4A closes; Product list/detail slice begins

- Unknown event copy, all eleven command-specific receipt semantics and the future-command forward-compatible fallback now pass direct tri-locale tests without changing canonical/history/dynamic values.
- Main Node 22 focused 3 files / 81 tests and typecheck/diff pass. Renewed independent QA and Architecture/Security both PASS P0 0/P1 0/P2 0.
- 2B-4B now owns only current Product list/detail employee presentation and shared read-state panels. No Quick Entry/Lifecycle/API/server/commit/push/deploy action starts at this checkpoint.

## 2026-09-03 — Release 2B-4B first review blocks on reachable mixed-language and dynamic-color boundaries

- Product-owned list/detail source passes Node 22 focused 10 files / 175 tests, full lint, typecheck, Prettier and diff checks, but independent QA/Security correctly inspect the complete Product Detail DOM rather than only Product-owned text.
- Default Apple/inspection health and feature-on lifecycle summary/history/editor panels remain fixed Chinese; local reference-image alt text is fixed Chinese; and catalog option inference is improperly used to translate dynamic/historical visible colors.
- A bounded remediation expands only to lifecycle/shared panels directly mounted by Product Detail plus list reference/color presentation and complete runtime evidence. No lifecycle route, create/edit, API/server/catalog data, commit, push or deployment is authorized.

## 2026-09-03 — Owner authorizes Inventory edit-data safe-error Delta

- **Authorization:** the Owner's explicit “确认” approves the previously proposed two-file `inventory/products/edit-data` raw-provider-error remediation.
- **Boundary:** after the active UI writer releases ownership, only `src/server/api/repairdesk-router.ts` and its direct test may change; unknown provider diagnostics map through the existing safe generic Product-read failure, while stable structured errors and successful responses remain unchanged.
- **Gates:** focused router security tests and renewed independent QA plus Architecture/Security are required. No API shape, repository, query/cache, schema/data, payload, permission, feature flag, commit, push or deployment is authorized at this checkpoint.

## 2026-09-03 — Release 2B-4B renewed review blocks shared semantics and mounted-path evidence

- **Evidence:** the writer-owned Node 22 packet passes 23 files / 223 tests, but expanded reviewers reproduce 6 stale legacy assertions and two deterministic shared-consumer regressions; final QA reports P0 0/P1 3/P2 1 and Architecture/Security P0 0/P1 2/P2 1.
- **Defects:** after-sales `open` changed from the established `待检测` meaning to generic `待处理`; the dirty-draft case-specific conflict title is replaced by generic version copy; Product Detail still lacks a complete three-locale mounted-path matrix for flag-off health and validation/pending/error/sync states. List ARIA direct assertions remain incomplete.
- **Decision:** no waiver or 2B-4C source work. Freeze the minimal semantic/test correction in `TASK.md`, preserve canonical status/recovery and the approved raw-color/reference-alt contract, then rerun expanded regression and both independent reviews.

## 2026-09-03 — Quick Entry 2B-4C read-only preflight and Scanner boundary reconciliation

- **Preflight:** independent QA and Architecture/Security report P0 0 and confirm the three production Quick Entry entry points share the same bounded create/edit workspace. Required work is three-locale chrome, stable validation codes, disclosure-first network/version/warranty/manual supplements, real create/update payload/CAS/idempotency tests and permission/offline/conflict/unknown/pending/success evidence.
- **Scanner:** the shared `ImeiScannerField` is directly visible from Quick Entry and still contains fixed Chinese presentation. The Integration Lead read the active Scanner Component Boundary Declaration and froze a presentation-only Delta: localize chrome/errors/ARIA while preserving the checksum-valid 15-digit IMEI gate and every capture/parser behavior.
- **Order:** this is contract/audit only. No 2B-4C source work starts until 2B-4B is independently green; the authorized edit-data router safe-error Delta remains a separate two-file packet.

## 2026-09-03 — Full-suite deterministic test-stability Delta

- **Evidence:** latest 2B-4B/Inventory suites pass, but a fresh full test run reports 502/504 files and 3785/3788 tests: Customer duplicate-warning visibility holds a detached transition node in two locale cases, and an AI minimal-card security canary accidentally matches `999` inside a random request UUID. The two files then pass cold focused 60/60.
- **Decision:** no retry waiver and no production change. Freeze the exact two-test-file deterministic correction in `TASK.md`; preserve localized conflict visibility and replace the random whole-response substring check with explicit sensitive-field absence assertions.

## 2026-09-03 — Release 2B-4B closes locally

- **Evidence:** full Inventory passes 90 files / 725 tests; high-risk closure packet passes 6 files / 174 tests; typecheck/lint/Prettier/diff pass. Product Detail has tri-locale real mounted coverage and Product List directly asserts localized Sheet/view/live-region semantics.
- **Review:** renewed QA PASS P0 0/P1 0/P2 0; renewed Architecture/Security PASS P0 0/P1 0/P2 1 non-blocking legacy-fallback maintainability note. Dynamic/canonical/reference/cost/identifier/error/CAS/idempotency/query contracts remain intact.
- **Next:** execute the already-frozen two-test deterministic full-suite correction, then activate 2B-4C Quick Entry. The Owner-authorized router edit-data safe-error packet remains separate and pending. No commit, push or deployment.

## 2026-09-03 — Deterministic tests and edit-data security close; Quick Entry begins

- **Test stability:** five cold scenario runs, two files 60/60 and full Node 22 Vitest 504 files / 3788 tests pass with zero retry; independent QA PASS P0 0/P1 0/P2 0. No production behavior changed.
- **Security:** edit-data safe-error router 48/48 and repository 9/9 pass. Unknown provider diagnostics fail closed; four exact stable errors and success remain compatible. Independent QA and Architecture/Security both PASS P0 0/P1 0/P2 0.
- **Next:** activate 2B-4C under the frozen Quick Entry and IMEI-scanner presentation-only contracts. No Lifecycle route/browser/CI/commit/push/deploy yet.

## 2026-09-03 — Release 2B-4C first review blocks real post-commit/edit/disclosure evidence

- **Candidate:** writer passes focused 17 files / 320 tests, access/runtime 43/43, Scanner 36/36 and all static gates without act warnings. Architecture/Security PASS P0 0/P1 0/P2 0.
- **QA:** FAIL P0 0/P1 3/P2 2. The real Quick Create Dialog closes before awaited parent synchronization and duplicates list refresh; Edit lacks same-tick submit lock and offline zero-write proof; new disclosure fields lack true mounted wiring tests. Scanner heavy-state/sentinel evidence remains incomplete.
- **Decision:** no waiver or 4D. Freeze the exact post-commit ownership, edit lock/offline, mounted disclosure and Scanner evidence remediation in `TASK.md`; Product List is reopened only for the create callback ownership. No API/server/query/cache/data/permission or release action.

## 2026-09-03 — Release 2B-4C closes; Lifecycle 2B-4D begins

- **Evidence:** final mounted Edit/disclosure packet passes 2 files / 88 tests; full Inventory 90 files / 781 tests; Scanner/parser/candidate 3 files / 89 tests; static gates pass without act/unhandled warnings.
- **Review:** renewed QA and Architecture/Security both PASS P0 0/P1 0/P2 0. Dialog post-commit ownership, Edit exactly-once/offline/CAS/idempotency, disclosure accessibility and Scanner presentation/boundary are closed.
- **Next:** activate remaining production Lifecycle reservation/sale/after-sales screens/forms as 2B-4D. Browser/CI/screenshots remain 4E; no commit, push or deployment.

## 2026-09-03 — Release 2B-4D Lifecycle preflight frozen

- **Baseline:** Node 22 core lifecycle baseline passes 11 files / 143 tests. Fixed employee UI remains concentrated in reservation/sell, sale detail and after-sales surfaces; QA baseline is P0 0/P1 6/P2 4.
- **Security:** P0 0/P1 1/P2 4. Reservation readback rejection can escape the error-panel action as an unhandled Promise; its minimum UI-boundary correction is added to 4D. Tenant/permission/CAS/idempotency/server boundaries remain fail-closed.
- **Contract:** preserve all nine reachable commands and exact payload/store/CAS/key behavior; localize only presentation, add customer combobox/ValidationSummary and exactly-once/offline/recovery evidence, and disclose `/sell` as a staged reservation-first flow. Deferred realtime/capability/query/preload/production-readiness P2s remain untouched.

## 2026-09-03 — Release 2B-4D first review blocks runtime semantics

- **Candidate:** nine commands × three locales construct canonical payloads; lifecycle/shared 16 files / 185 and full Inventory 90 files / 811 pass with static gates.
- **Review:** QA FAIL P0 0/P1 4: combobox Escape, host-timezone datetime parsing, body-independent idempotency keys, and missing locale-switch/QueueScreen/reservation lock runtime evidence. Security also finds server-derived unknown status/payment/coverage lookups can render blank or mislabel pending.
- **Decision:** no waiver or 4E. Freeze the exact Rome wall-time rejection policy, fingerprinted keys, accessible close behavior, real screen evidence and raw unknown fallback in `TASK.md`. Deferred realtime/capability/query/preload/production-readiness P2s remain untouched.

## 2026-09-03 — Release 2B-4D closes; strict Inventory browser packet begins

- **Evidence:** Node 22 focused lifecycle/shared 23 files / 258 tests, full Inventory 90 files / 838 tests and shared i18n 4 files / 13 tests pass. Mounted canonical reservation submissions pass in four host timezones; typecheck, ESLint, Prettier, diff and waiver scans pass.
- **Review:** renewed QA and Architecture/Security both PASS P0 0/P1 0. Escape/privacy, Rome gap/overlap rejection, payload-fingerprinted keys, locale preservation, queue state matrix, offline/exactly-once behavior and unknown runtime passthrough are closed.
- **Residual:** add a dedicated customer-search loading assertion in 4E. Keep the five already registered lifecycle realtime/capability/query/preload/production-readiness P2s explicit and unchanged.
- **Next:** run 2B-4E across ten Inventory routes, three locales, six widths and Chromium/WebKit with strict request/error/write gates and sanitized screenshots. No stage, commit, push or deployment yet.

## 2026-09-03 — Release 2B-4E first Chromium gate corrects menu-focus evidence

- **Observed:** the first Chromium heavy run passes the ten-route English 1440 matrix and exact staged `/sell` `reservation.create`, but fails an assertion that locale-menu selection must return focus to the previously focused Quick Entry model field.
- **Cross-review:** QA and Security agree after one bounded cross-question that the real action-menu path should return focus to the visible language trigger; arbitrary old-element restoration would contradict the existing menu contract and expand cross-page focus risk. Programmatic locale rerender remains separately covered by 4C field/disclosure focus tests.
- **Decision:** no production change. Correct the 4E test to the real menu contract, remove the unsupported disclosure claim, keep dedicated Inventory disclosure browser evidence, and complete the remaining high-risk state and full dual-engine matrix. No waiver, commit, push or deployment.

## 2026-09-03 — Release 2B-4 Inventory closes; Transparent Buyback begins

- **Browser:** final Chromium 20/20 and WebKit 20/20 pass with 184 sanitized screenshots per engine, 368 total. Independent QA runs six Italian compact/desktop subsets per engine and confirms no clipped desktop lifecycle title or overlapping compact Quick Entry actions.
- **Quality/security:** direct responsive tests 2 files / 9 pass; typecheck, target lint, Prettier, diff and waiver scans pass. QA and Security PASS P0 0/P1 0/new P2 0. Five existing deferred Inventory P2s remain unchanged.
- **Decision:** locally close Release 2B-4 and activate read-only 2B-5 Transparent Buyback audit. Production Apple routes remain pending without an authorized official overlay; do not add catalog data or a test-only production flag. No stage, commit, push or deployment.

## 2026-09-03 — Release 2B-5 Transparent Buyback contract frozen

- **Baseline:** production `/buyback` is the quote-only transparent screen; Node 22 audits pass 9 files / 73, 11 files / 168 and 12 files / 170 across domain/server/permission/schema projections. The dormant evidence/agreement/payment/finalize workspace is not in the production route and remains forbidden.
- **Blocking implementation:** fixed production UI is almost entirely Chinese; raw provider errors can enter toast/DOM; dates are fixed zh-CN and invalid-unsafe; deep links, store/read states, labels/validation/focus, exactly-once/idempotency evidence and strict tri-locale browser coverage are missing.
- **Security stop:** alphanumeric document tokens can enter append-only free-text ledger fields. Presentation work may proceed, but total 2B-5 closure needs explicit Owner confirmation before the proposed server sensitive-text validator Delta. Existing history will not be scanned or rewritten.
- **Decision:** freeze the presentation-only 2B-5A/B allowlist and later strict 2B-5C browser packet; preserve all canonical/dynamic/ledger/legal data and quote-only boundaries. No commit, push or deployment.

## 2026-09-03 — Release 2B-5A closes; mutation recovery begins

- **Evidence:** 163 Buyback keys per locale; Buyback 9 files / 99 tests; expanded API/router/schema/permission/mock 17 files / 276; Scanner 42; all static gates pass.
- **Review:** QA and Security PASS P0 0/P1 0/new P2 0. Sensitive search remains out of URLs, scanner identity is accessible, locale state is stable and complete authority changes remove old local content before paint with zero stale read/write.
- **Next:** activate 2B-5B create/revise/respond synchronous-lock, fingerprinted idempotency, conflict/outcome/readback and post-commit recovery evidence. The separate server sensitive-text Owner gate remains open; no browser/commit/push/deploy yet.

## 2026-09-03 — Owner authorizes the bounded Buyback sensitive-text Delta

- **Owner decision:** `确认` explicitly authorizes the previously frozen future-input validator Delta for high-confidence phone, IMEI, email, URL and approved Italian document patterns in Buyback free-text ledger inputs.
- **Boundary:** no existing history scan/backfill; no endpoint, response, database schema, migration, permission, CAS, idempotency, legal/customer-output, dormant workflow or production-data change. Rejected sensitive content must not be echoed. Normal zh/it/en business reasons and accepted original text remain compatible.
- **Sequence:** finish and independently close the active 2B-5B mutation-recovery remediation first; then transfer single-writer ownership to the validator Delta and verify it before 2B-5C browser evidence. No commit, push or deployment yet.

## 2026-09-03 — Release 2B-5B closes; sensitive-text Delta begins

- **Evidence:** Buyback 9 files / 137 tests and expanded 17 files / 314 tests pass under Node 22 with typecheck, target lint, Prettier, diff and waiver gates. Exact mounted coverage includes twelve revise unknown-result combinations, response null-baseline protection, authority-late failures, strict 409 recovery, three-command offline/sync-only and pending locks.
- **Review:** renewed independent QA and Security both PASS P0 0/P1 0/new P2 0. No timestamp-only, competing-write or old-response false confirmation remains.
- **Next:** transfer single-writer ownership to the authorized future-input sensitive-text validator Delta, then renew QA/Security and execute 2B-5C Chromium/WebKit. No commit, push or deployment.

## 2026-09-03 — Release 2B-6 production preflight recorded

- **Route evidence:** the last release unit covers real Settings/Closed Stores, Messages, Finance, Memos, flag-gated Toolkit, Platform, Account and global AI surfaces; dead/unexported modules are excluded.
- **Baseline:** Node 22 115 files / 698 tests pass. P0 0; seven P1 classes remain across localization, authority cache, safe errors, Rome due-time, disabled Platform approve, Finance mobile layout and missing release evidence.
- **Decision:** keep 2B-5 as the active writer sequence. Freeze serial presentation slices for later 2B-6 and require separate reviewed deltas before changing authority cache, broad error/server, business-time or server-owned AI presentation contracts. No stage, commit, push or deployment.

## 2026-09-03 — Buyback sensitive-text Delta closes; 2B-5C browser starts

- **Evidence:** final Node 22 focused 4 / 239, Buyback 10 / 240 and server API 11 / 171 pass with all static gates. Detection-only Unicode shadow, exact official/document shapes, bounded token/phone/IMEI parsing and four server fields are covered; accepted canonical payloads and `serial_or_imei` remain unchanged.
- **Review:** QA PASS P0 0/P1 0/P2 0. Security PASS P0 0/P1 0/new P2 1 for conservative all-uppercase natural-language rejection. Universal format coverage and old-ledger backfill remain explicitly out of scope.
- **Next:** execute strict synthetic Chromium/WebKit 2B-5C across three locales and six widths with request/write/error/privacy gates and sanitized screenshots. Sensitive rejected values must never be screenshotted or traced. No commit, push or deployment.

## 2026-09-03 — Release 2B-5 closes; Settings package 1 review is active

- **Browser:** final strict Chromium 26/26 and WebKit 26/26 pass with retry zero. Each engine retains 54 core list/workspace/detail images plus 17 high-risk images; 142 sanitized PNGs total and no zero-byte evidence. The exact 2B-5 spec is included in CI.
- **Corrections:** real-browser gates closed four production P1s without business-boundary expansion: mobile footer reachability, authority-safe opener focus restoration, 44px critical touch targets and deterministic SSR/client-first hydration. Buyback now passes 10 files / 250 tests plus typecheck and static gates.
- **Transition:** Release 2B-5 is locally closed. Release 2B-6 package 1 Settings shell/overview is implemented and under renewed QA/Security review; QA found one reachable order-data access-copy localization gap, so the same presentation allowlist is reopened only for its code-specific tri-locale mapping. No API/query/cache/payload/permission/time or release action.

## 2026-09-03 — Settings package 1 closes; personal/access package starts

- **Evidence:** package 1 has 137 Settings keys per locale and passes the complete Settings suite at 37 files / 199 tests. The seven canonical Order Data access codes plus undefined pass 24 mounted tri-locale states; it/en contain no Chinese in the access card, protected reads remain zero and canonical routes/access rules are unchanged.
- **Review:** renewed QA and Security both PASS with P0/P1/P2 zero. Shell, overview, navigation, safe shared state and account summary can close; section body copy and raw mutation errors remain later serial work.
- **Next:** activate package 2 for Settings personal/access sections and `/account`, limited to fixed staff presentation and UI-safe errors. Preserve member/account payloads, invitations, roles, permissions, transient secrets, audit content and all query/CAS/idempotency behavior.

## 2026-09-03 — Settings package 2 review reopens action evidence

- **Candidate:** 239 new tri-locale keys cover personal, member/access and `/account` surfaces. Focused 8 files / 80 and full Settings+Account+Auth 47 files / 263 pass with static gates; fixed visible Chinese and raw unknown UI errors are removed within the package.
- **Review stop:** QA requires real production-consumer exact-body and same-tick exactly-once evidence for every account and member mutation rather than representative callbacks. Security confirms email invite, invite-link creation and resend currently rely only on asynchronous pending state and retain a same-tick duplicate-submit P2.
- **Decision:** no waiver. Reopen only the existing package allowlist to add synchronous UI locks and the complete zh/it/en action matrix. Preserve every canonical body, role/status/permission code, persisted rejection note, query/permission rule and transient-secret boundary; add no API field or server-side idempotency mechanism.

## 2026-09-03 — Settings package 2 closes; store-operations package starts

- **Evidence:** final package passes focused 5 files / 93, full Settings+Account+Auth 47 files / 296 and security permission/repository/query/access 4 files / 98. Account has five actions × three locales; Settings has twelve real production consumer paths with exact locale-free bodies and the canonical persisted rejection note unchanged.
- **Controls:** synchronous UI locks now close same-tick duplication for account actions, account-name, direct invite, invite-link and per-invitation resend. Existing member destructive/action locks remain. Safe failures consume rejected Promises and never expose raw provider text.
- **Review:** renewed QA and Security both PASS P0/P1/P2 zero. Activate package 3 for store operations, suppliers, kiosk, closed stores and lifecycle overlays. Preserve store/tenant authority, destructive confirmations, MFA, transient secrets, payloads, purge/rename/close semantics and repository behavior.

## 2026-09-03 — Settings package 3 pre-review freezes safety corrections

- **Inventory:** the package has fourteen business mutations plus store-profile save and lifecycle preflight, for sixteen production write paths to prove. Current tests are insufficient for a no-waiver locale/payload/exactly-once closure.
- **P1 findings:** owned UI can expose raw provider errors; create-store, supplier save, close, restore and rename acquire protection after asynchronous work; purge preflight begin lacks a synchronous gate; create-store generates a new request ID on retry and can duplicate a tenant after an ambiguous lost response.
- **Presentation findings:** Kiosk, closed-store and purge dates require locale plus Europe/Rome and invalid-safe output; output block reason and purge export state require stable-code presentation. Permanent-delete confirmation phrases and the Kiosk default payload label remain canonical bytes across locales.
- **Decision:** close these issues inside the frozen UI/test allowlist with pre-await locks and a payload-fingerprinted retained create-store request ID. Unknown outcomes use existing readback/idempotent retry only; no API, schema, permission, tenant, repository, migration or production-data change is authorized.

## 2026-09-03 — Settings package 3 closes; business/output package starts

- **Evidence:** final package contains 26 allowlisted files and proves all sixteen production consumer actions. Focused 12 files / 125 and full Settings+i18n 40 files / 268 pass with captured stderr zero; independent security server/router/schema regression passes 6 files / 210.
- **Review:** QA PASS P0/P1/P2 zero. Security PASS P0/P1 zero with four retained P2s: Kiosk return draft in session storage, public pairing rate-limit verification, supplier `tel:` normalization and protocol-level idempotency for supplier create/pairing. None is changed in this presentation batch.
- **Next:** activate package 4 for business rules, notifications/output, order workflow, AI usage and order-data/cost/procurement settings. Preserve customer-facing message/print bodies and previews, workflow/status canonical data, export/import payloads, cost values, permissions, CAS and idempotency.

## 2026-09-03 — Settings package 4 closes; Messages package starts

- **Evidence:** the final 29-path package proves fifteen production consumers and passes focused 14 files / 204 tests plus full Settings+i18n 40 files / 371 tests with captured stderr zero. Typecheck, full lint, scoped Prettier, diff and no-waiver scans pass.
- **Review:** renewed QA and Security both PASS with P0/P1 zero. The review-driven CSV remediation sanitizes raw import issues in report-only clones while preserving source objects, report shape and dynamic IDs; the Settings save authority epoch discards same-store downgrade and A→none→B late results before cache, toast or validation state effects.
- **Contracts:** canonical Italian customer message/print previews, signature/footer, server export Blob bytes/MIME/filenames, workflow codes, dynamic labels, payloads, permissions, CAS and idempotency remain unchanged. Consolidated six-width Chromium/WebKit evidence remains the later Release 2B-6 browser gate.
- **Next:** activate the Messages presentation package. Translate fixed employee UI only; preserve template defaults, customer message bodies, rendered previews, signatures, dynamic values and save payloads byte-for-byte.

## 2026-09-03 — Messages review opens a bounded token-registry Plan Delta

- **Review findings:** final QA found three canonical variables already used by enabled production defaults (`parts_update_line`, `issue_line`, `cancel_reason_line`) missing from the editor variable registry, so valid templates are falsely blocked as unknown. Security also found a query-cache-before-rerender authority window and stale draft ownership after same-store authority replacement.
- **Bounded Delta:** add only `src/features/messages/model/message-template-defaults.ts` and a direct sibling test to the Messages allowlist so the three existing canonical names can be registered and presented in three locales. Default template bodies and token bytes, the renderer, API, payload, permissions and server behavior remain immutable.
- **Remediation:** callbacks must verify current store/read/update query context before side effects, and drafts must be owned by the exact authority fingerprint so downgrade or identity replacement removes stale draft/preview data while a locale-only change preserves it.
- **Gate:** no waiver. Re-freeze the six-path package, rerun Messages/server/i18n and Settings regressions, then obtain renewed independent QA and Security signatures before closing the package.

## 2026-09-03 — Messages closes; Finance package starts

- **Evidence:** the final six-path Messages package passes focused 3 files / 55 tests, Messages 9 / 82 and Settings+Messages+i18n 52 / 461 with stderr zero. Typecheck, full lint, scoped Prettier, diff and no-waiver/raw-copy scans pass.
- **Review:** three review cycles close raw-error, synchronous lock, query-cache-before-rerender, stale draft ownership and same-store membership replacement races. QA and Security both PASS with P0/P1 zero.
- **Contracts:** update/reset requests, permissions, query keys, customer Italian template bodies, rendered previews, signature/footer, dynamic values and canonical token bytes remain unchanged. The bounded registry Delta only registers three tokens already used by production defaults; every enabled default now has zero unknown variables.
- **Next:** activate Finance presentation and mobile-density remediation. Preserve aggregation permissions, query/filter inputs, currency/cost values, export payload/Blob/filename and dynamic financial data.

## 2026-09-03 — Finance closes; Owner-gated Release 2B-6 Deltas reached

- **Evidence:** the final Finance package passes focused 2 files / 51 tests, Profit server/API/permission 10 files / 180 tests and Settings+Messages+i18n 52 files / 462 tests with stderr zero. Typecheck, lint, Prettier, diff and no-waiver/raw-copy scans pass.
- **Review:** QA and Security both PASS P0/P1 zero. Mobile/tablet use a single accessible card DOM while desktop keeps tables. Cross-store placeholder leakage, cached authorization errors, export/refresh same-tick and no-rerender authority races, no-store ordering, locale-stable notice and invalid-date accessibility are closed.
- **Retained P2:** `profitKeys.all` is not yet in centralized tenant/authority cache cleanup, and export lacks protocol-level idempotency. The first can be considered with the already-blocking shared authority-cache Delta; the second requires a separate future API Delta and is not needed for presentation closure.
- **Stop condition:** the next serial slices cannot proceed safely without explicit Owner approval for four preflight Deltas: shared Toolkit/Platform (and now Finance cleanup-root) authority cache, removal of the impossible Platform approve affordance, Europe/Rome memo due-time semantics, and locale-aware server-owned AI response metadata. No source work on these Deltas begins before approval.

## 2026-09-03 — Owner authorizes all four Release 2B-6 Deltas

- **Authorization:** Owner replied `确认全部`, explicitly approving the four previously frozen Deltas: Memos Europe/Rome due-time semantics; shared Toolkit/Platform/Finance authority-cache cleanup; removal of the server-impossible Platform approve affordance; and locale-aware server-owned AI response metadata.
- **Boundaries:** no schema, migration, production data, secret, dependency, external API, customer-body or release action is added. API/request/response shapes, tenant derivation, permissions, CAS/idempotency and dynamic business values remain immutable unless the frozen AI locale field already exists.
- **Execution order:** close the Memos time Delta and presentation first; then shared cache, Toolkit and Platform action/presentation; then AI metadata/client presentation. Each slice requires independent QA/Security and full local gates before consolidated browser evidence, main push and deployment.

## 2026-09-03 — Memos Rome Delta closes; presentation starts

- **Evidence:** the five-path time Delta passes focused 2 files / 30 tests and all Memos 11 files / 59 tests with stderr zero. Host-TZ subprocesses, DST gap/overlap, valid overlap absolute instants, invalid server values and seconds/milliseconds preservation pass.
- **Review:** QA and Security both PASS P0/P1/P2 zero. Editor submission now uses a unique Europe/Rome candidate, rejects gap/overlap, preserves untouched canonical instants and uses one pre-await lock across button/Enter/Ctrl+Enter without changing CAS or operation ID semantics.
- **Next:** activate Memos presentation across the live screen, cards, list states, status and overlays. Translate fixed staff UI only; preserve memo content, assignee names, IDs, filters, request bodies, versions and operation IDs. The already-recorded raw `memos-screen` error P1 must close before the package can finish.

## 2026-09-03 — Owner restarts under lightweight i18n-only policy

- **Superseding scope:** only translation coverage, locale switching, i18n metadata/output/parity and responsive/a11y defects directly caused by localization remain. Memos, Toolkit, Platform and AI client presentation form the first and final legal four-group batch.
- **Stopped/backlogged:** the in-progress Memos authority/PII/idempotency remediation, Toolkit/Platform/Finance cache architecture, Platform approve business behavior, AI server/API/tool behavior, protocol idempotency and repeated security rounds. These findings do not block the i18n task.
- **Verification reset:** use one targeted validation for the four-group code batch, one QA per completed module, and one final i18n release verification after all four groups. Reuse all prior passing evidence where the relevant files/state do not change.
- **Release boundary:** no commit, push, deploy, remote SQL or production migration. Deliver a release-ready handoff and request a separate release decision.

## 2026-09-03 — Lightweight final-four code batch and module QA pass

- **Completed:** Memos, Toolkit, Platform and AI client fixed UI/ARIA/validation/fallback copy now support `zh-CN`, `it-IT` and `en`. Memos retains the completed Europe/Rome due-time Delta; its unfinished authority/PII/cache/lock work was removed. Toolkit preserves the canonical `platform: "桌面"` payload. AI suggestions display localized labels while submitting the original canonical Chinese request values.
- **Evidence:** one targeted batch run passes 13 files / 84 tests with zero stderr or React `act` warnings. Typecheck, scoped ESLint/Prettier and diff checks pass. The single independent module QA returns PASS with direct-i18n P0/P1 both zero.
- **Remaining:** one final unified browser i18n verification and sanitized screenshots. Loading/empty/error/permission state evidence from the passing module tests will be reused instead of repeated.
- **Release boundary:** candidate remains local and uncommitted. No stage, commit, push, deploy, remote SQL or migration is authorized in this restarted task.

## 2026-09-03 — Conditional local closeout and release handoff

- **Direct i18n result:** PASS. Memos, Toolkit, Platform and AI client complete the remaining fixed-presentation scope; independent QA reports direct-i18n P0/P1 zero.
- **Browser result:** CONDITIONAL. Memos and Toolkit pass. Platform and AI reach and pass their locale/viewport/dynamic/ARIA/overflow checks but stop on existing mobile Escape focus-return P2. Four sanitized synthetic images and the failure traces are retained; no 4/4 browser PASS is claimed.
- **Documentation/memory:** employee i18n declaration, untranslated UI audit, CEO report, capability review, project/departments/backlog/index and Active Context are synchronized.
- **Release:** no commit, push, deploy, remote SQL or migration occurred. The next action is a separate Owner release decision, not automatic continuation of this task.

## 2026-09-03 — Owner approves the separate release task

- **Approval:** Owner replied `批准` to the explicit request to release the current i18n candidate.
- **Scope:** exact candidate reconciliation, final proportional gates, normal commit, non-force `main` push, existing Vercel production deployment, exact-SHA/canonical smoke, observation and rollback evidence.
- **Exclusions:** no database, migration, environment, secret, production-data, force-push or unrelated project-health work.
- **Next:** advance the Registry instruction version, issue/verify a new immutable Context Packet, acquire the integration lease and freeze the exact release path set before staging.
