# Checkpoints — TASK-20260720-002

## 2026-07-20T13:16:04Z — Context ready and implementation approved

- **Phase:** planned → implementing.
- **Owner authorization:** “開始按照報告來修復這些bug,完成後推送並應用。”
- **Baseline:** isolated branch from `origin/main` at `0a0ec0f5a7b3aa4fc992977da172732576686379`; original dirty workspace preserved.
- **Risk:** R3/L2; production release explicitly approved, no database work.
- **Agents:** three real read-only packages spawned for print, intake, and QA/security/release.
- **Next:** collect implementation recommendations, run narrow baseline, then implement WP-01 under single-writer control.

## 2026-07-20T13:39:00Z — Candidate implementation and automated gates complete

- **Phase:** implementing → release candidate.
- **Print:** same-layer Safari isolation, non-clipping pagination, formal task-page customer document, internal QR/link removed, explicit list print lifecycle.
- **Intake:** Guard now closes/detaches/unlocks before route execution; outcomes are observable; new intake sessions and abortable keyed prefill implemented; dialog reopen remounts cleanly.
- **Automated evidence at this checkpoint:** lint/typecheck/build PASS; full Vitest 320 files/2104 tests PASS; Chromium 3/3; WebKit 3/3; standard PDF 1 page; long PDF 2 pages. The final superseding gate is recorded below.
- **Security:** no migration/dependency/env changes; production E2E bypass flag names absent.
- **Release state:** remote main still `0a0ec0f5`; rollback deployment recorded; waiting independent final reviews before scoped commit/push.
- **Residual:** actual Safari native print dialog and HP paper require real-device confirmation after deploy.

## 2026-07-20T13:53:00Z — Release checkpoint

- **Candidate:** isolated worktree, remote/base `0a0ec0f5a7b3aa4fc992977da172732576686379`; original dirty checkout untouched.
- **Final automated gate:** lint PASS; typecheck PASS; Vitest 321 files/2108 tests PASS; production build PASS; Chromium 4/4; WebKit 4/4; standard/batch/long PDFs 1/2/2 pages.
- **Independent reviews:** print, FLOW/UX and QA/security/release report no remaining code/security BLOCKER; decision is CONDITIONAL GO for scoped push/deploy.
- **Security/config:** customer internal QR/link removed; production E2E bypass flag names absent; no migration, lockfile, dependency, env or secret change.
- **Rollback:** previous READY production `https://chinatech-codex-21k1mhy9q-kyox120-9295s-projects.vercel.app`; git rollback is explicit revert, never force push.
- **Next:** final fetch, exact stage/commit/push to main, wait exact Vercel SHA READY, canonical/auth/error smoke, then keep task observing for real Safari/HP evidence.
- **Stop:** remote non-fast-forward, staged scope drift, deployment ERROR/non-matching SHA, auth bypass, canonical 500, or print/intake regression.
