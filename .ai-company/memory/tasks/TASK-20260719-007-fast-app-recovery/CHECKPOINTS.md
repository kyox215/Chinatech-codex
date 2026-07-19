# Checkpoints — TASK-20260719-007-fast-app-recovery

## 2026-07-19T18:01:27Z — baseline and contract

- Baseline: `origin/main@25752bd17e424471ce94af033632248b0f60ff29` in isolated worktree.
- Verified: old client `wait` has no self-wakeup; recovery disappears when Next JavaScript is unavailable.
- Approved scope: global recovery shell, focused PWA navigation safety, tests and task evidence.
- Forbidden: database, business data, new dependencies, root checkout, push and deploy.

## 2026-07-19T18:38:36Z — implementation and verification checkpoint

- Added inline single-authority recovery with fixed same-origin probe, 750ms visible polling, 750ms timeout, 500ms stylesheet retry and 1200ms runtime grace.
- `AppStyleRecovery` is now only a React runtime handshake; CSS marker alone cannot claim interactive readiness.
- Added one-auto-reload-per-60s policy, storage-restricted loop protection, 2.5s manual action and accessible 44px retry button.
- Upgraded offline shell cache to v3 and bounded Service Worker navigation fetch at 3 seconds.
- Production-build Chromium and WebKit each passed 8/8; both assert recovery action within the 3-second hard cutoff.
- Full gates passed: agents, lint, typecheck, 311 test files / 2020 tests, build, diff/static checks.
- Mobile and desktop recovery screenshots were inspected and contain no customer data.
- Plan delta: production WebKit proved that CSS readiness can coexist with missing JavaScript; runtime handshake became a required readiness condition instead of an optional optimization.
- Residual risk: an automatic reload can affect an unsaved page, but it occurs only while the global shell is unusable, after direct style recovery fails, and at most once per 60 seconds.
- `ACTIVE_CONTEXT.md` intentionally remains unchanged because the concurrent Vision 24-hour observation owns it.
- Next: final diff review and local candidate commit; do not push or deploy without Owner approval.

## 2026-07-19T18:49:03Z — final readiness correction and memory checkpoint

- Independent QA and architecture review found one pre-commit blocker: when CSS loaded but Next JavaScript did not, the page could briefly expose a non-interactive shell before the 1200ms runtime grace expired.
- Corrected the readiness gate by rendering `<html data-style-recovery="booting">` on the server and allowing only `markReady()` after CSS + React runtime double readiness to remove the recovery state.
- Replaced the mixed CSS+JS loss proof with a JS-only production E2E: CSS marker is `1`, runtime is false, fallback remains visible and shell remains hidden across 1300ms, then a refresh starts within 3 seconds of reachability.
- Post-fix production gates: build PASS; Chromium 8/8 PASS; WebKit 8/8 PASS; full lint PASS; full Vitest 311 files / 2020 tests PASS; typecheck, targeted 7/7, agents check, diff check, Service Worker syntax and probe token PASS.
- Both independent reviewers returned final PASS for a local candidate commit. They did not modify files or authorize push/deploy.
- Residual release checks: real iPhone background/BFCache/network-switch behavior and registered Service Worker path remain production-smoke items; automatic refresh can still affect unsaved input, bounded to the unusable global shell and once per 60 seconds.
- Release state remains unchanged: not pushed and not deployed. `ACTIVE_CONTEXT.md` remains untouched because the concurrent Vision observation owns it.

## 2026-07-19T19:35:21Z — Owner release approval and production preflight checkpoint

- Owner explicitly approved executing the plan, pushing to `main`, and applying Supabase/migrations.
- Release phase is classified T3 / R4 / L1 because it changes the customer-visible production deployment and crosses the database application gate.
- Fresh `git fetch --prune` confirms `origin/main@25752bd1`; candidate `94243401` is its direct child, worktree clean, and contains no `supabase/` or migration path.
- Root checkout remains ahead 2 / behind 108 with extensive unrelated state; it is excluded from all staging, commits and pushes.
- Supabase target was independently verified as `ChinaTech_date` / `xluzcoduqsdvjoouqhkc`, status `ACTIVE_HEALTHY`, PostgreSQL 17.
- `supabase migration list --linked` shows all 91 local/remote timestamps paired through `20260718223739`.
- `supabase db push --linked --dry-run` returned `Remote database is up to date`; no migration is eligible for application and historical SQL must not be replayed.
- Supabase advisors contain pre-existing security/performance warnings; this candidate changes no database object, so warnings are recorded as baseline and remain outside this scoped Web reliability release.
- Stop conditions: any movement of `origin/main`, unexpected pending migration, failed final quality gate, non-fast-forward push, failed production deployment, reload loop, false-ready shell, or loss of login/session state.
- Rollback: revert the exact Web commit and restore the previous READY deployment; no database rollback is expected because the database step is a no-op.
- `ACTIVE_CONTEXT.md` remains under the Vision 24-hour observation task and will not be overwritten; this release boundary must be noted in that later read-only review.

## 2026-07-19T20:10:32Z — real Service Worker blocker closed and final pre-push checkpoint

- Release QA required a production-build smoke with Service Worker registration enabled because the original 8-case recovery spec intentionally blocks Service Workers.
- The first v3 smoke reproduced a real blocker: the cached Next `/offline` document could become CSS/runtime ready and stop probing after connectivity returned.
- A static marker correction fixed Chromium, but controlled WebKit testing exposed a deeper iPhone/Safari behavior: failed Next module loads from the offline document were not retried after the first recovery reload, leaving `runtimeReady=false`.
- Plan delta: replaced the Next `/offline` navigation fallback with standalone `/offline-fallback-v1.html`. It has inline system-color CSS and a classic inline controller only; it contains no `/_next/`, external script/style/font/image, manifest, dynamic import, business data or PII.
- The standalone controller shares the exact probe path/token, state version, session key, 750ms poll/timeout, 60-second window and one-auto-reload limit with the main bootstrap. It pauses while hidden, responds to online/pageshow/focus/visibility/resume, and exposes a 44px manual action.
- Service Worker cache is now `repairdesk-shell-v4`; only GET navigation receives the fallback, cache miss returns explicit 503, and activation deletes only older `repairdesk-shell-*` caches while preserving unrelated business caches.
- A controllable local connection-drop proxy was used because Playwright WebKit's `context.setOffline(true)` navigation fails internally before the Service Worker can handle it. The proxy destroys the origin connection while leaving the browser online, then independently enables full or probe-only reachability.
- Real SW production results: Chromium 3/3 PASS and WebKit 3/3 PASS. Both engines proved final `stylesReady=1`, `runtimeReady=true`, one recovery navigation within 3 seconds, zero Next assets from the standalone shell, v2/v3-to-v4 cleanup, fallback cached, unrelated cache retained, and cookie/localStorage/IndexedDB retained.
- Both engines also proved no loop when the probe succeeds but the application navigation still fails, including with sessionStorage disabled: one navigation only, then manual recovery.
- Post-fix original recovery matrix: Chromium 8/8 PASS and WebKit 8/8 PASS.
- Final full gate: agents/lint/typecheck PASS; Vitest 311 files / 2022 tests PASS; production build PASS; SW syntax, fallback dependency scan and `git diff --check` PASS.
- Visual evidence added for recovered mobile production build in both engines; no customer data is present.
- Remaining production-only validation: exact Vercel SHA Ready, production SW v4/probe HTTP checks, mobile/desktop normal smoke, and real iPhone background/BFCache/network-switch observation. Any loop, false-ready shell, session loss or >3-second no-action remains an immediate rollback condition.
- Database state is unchanged: 91/91 migrations aligned and dry-run up to date; database execution must remain a successful no-op.
- This is the required `memory-checkpoint` before external Git/deploy writes. `ACTIVE_CONTEXT.md` remains owned by the Vision 24-hour observation task.

## 2026-07-19T20:14:26Z — final independent GO and post-source quality checkpoint

- Final source was minimized after the v4 implementation; no main-bootstrap behavior remains beyond the already reviewed `94243401` candidate.
- A new full `npm run check` completed after the last source change: agent rules, lint, typecheck, 311 Vitest files / 2022 tests and production build all PASS.
- Independent Architecture review returned PASS for the current standalone fallback, GET-only SW behavior, reload-loop boundary and cache scope.
- Independent Release QA returned GO for exact scoped commit, non-force main push and deployment, conditional on a final fresh fetch and successful production smoke.
- `git diff --check` and scoped secret scan are clean; there is still no Supabase, dependency, environment or deployment-config diff.
- The worktree is intentionally dirty only because final v4 source, tests, screenshots and task evidence are waiting for an exact scoped commit. Do not push old HEAD `94243401` alone.
- Next external write: stage the explicit intended path list, inspect staged diff, commit, fetch again, require fast-forward/no overlap, then push without force.

## 2026-07-19T20:16:01Z — exact scoped release candidate committed

- Exact staged scope contained 11 intended paths only: v4 SW, standalone fallback, contract/E2E, two no-PII screenshots and this task's evidence files.
- Staged diff check passed; no unstaged path remained; scoped secret scan returned no match.
- Commit `8fa5b172` (`fix: recover service worker offline shell safely`) records the final v4 blocker closure on top of `94243401`.
- Combined candidate remains free of Supabase migrations, dependencies, environment files and deployment configuration.
- Next: commit this SHA checkpoint, fetch `origin/main` immediately, verify ancestor/no-overlap and non-force push the exact resulting HEAD.

## 2026-07-19T20:26:29Z — production release and closeout memory checkpoint

- The isolated release branch was fast-forward compatible with fresh `origin/main@25752bd1`; exact HEAD `1119ef5d` was pushed to `main` without force. A post-push fetch shows `origin/main` equals local HEAD with ahead/behind `0/0`.
- Vercel Git deployment `dpl_3RmTx8EKHszdMvMpbeNYG57B21H9` reached `READY` for exact Git SHA `1119ef5d` at `2026-07-19T20:19:14.432Z`; aliases include `www.chinatech.in` and `chinatech.in`. `dpl_BeC1n2JbSipLvLbRLgjhWyXY5wZY` / `25752bd1` was the pre-recovery candidate at that instant but is no longer safe to promote after descendant releases; recovery rollback must now be a scoped revert on latest main.
- Canonical production HTTP checks passed: www probe returned exact `repairdesk-recovery-v1`; naked domain returned 308 to www and then the same token; `/sw.js` serves `repairdesk-shell-v4`; `/offline-fallback-v1.html` is standalone; unauthenticated protected routes return expected auth redirects.
- The post-publication Supabase gate again listed all 91 local/remote migrations in pairs and `supabase db push --linked --dry-run` returned `Remote database is up to date`. No pending migration existed, so application completed as a deliberate zero-write no-op; no historical SQL was replayed.
- An existing authorized test session opened production at 390x844 and 1440x900. Both responsive overview layouts rendered; browser warning/error logs were empty. Screenshots contain no customer data.
- Vercel's scoped one-hour runtime-error query returned none; deployment-scoped error/fatal/warning logs were empty.
- During closeout another approved publisher advanced `origin/main` by `445b5e81` and `5c67d451`. Release work stopped, then verified `1119ef5d` is an ancestor, the two commits contain zero recovery-path or migration diff, and current production `dpl_BAKzwYuQisiDChY6MN69wRCB2uVH` is READY with the same probe/SW v4 plus empty scoped runtime errors. Closeout documentation must be replayed on that latest main without touching its `ACTIVE_CONTEXT.md`.
- The closeout commit was rebased onto `5c67d451` with both tasks' memory retained. Latest-main combined gates passed agents/lint/typecheck and 311 files / 2033 tests. The first build attempt failed only because the sandbox could not fetch three Google Fonts; an authorized network-enabled retry compiled, typechecked and generated all 26 pages successfully.
- Documentation sync updated the active recovery runbook and PWA execution-plan wording. Memory consolidation promoted the double-readiness/standalone-fallback contract while leaving physical-iPhone background/BFCache/network-switch evidence as owned backlog, not as a claimed guarantee.
- Capability review creates only a C1 candidate for bounded PWA recovery delivery; no permission or autonomy increase is granted.
- This is the required final `memory-checkpoint` after external writes and before task closure. This task did not modify `ACTIVE_CONTEXT.md`; concurrent `main` recorded the closed AI natural-language-query V3 task there, and this closeout preserves that external state.
