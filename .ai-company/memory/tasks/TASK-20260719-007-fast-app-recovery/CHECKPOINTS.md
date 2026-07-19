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
