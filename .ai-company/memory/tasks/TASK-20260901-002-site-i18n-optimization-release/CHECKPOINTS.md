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
