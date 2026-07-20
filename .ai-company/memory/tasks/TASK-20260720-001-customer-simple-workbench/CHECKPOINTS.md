# Checkpoints — TASK-20260720-001

## CP-01 — Pre-release gate

- Time: 2026-07-20T01:45:00+02:00
- Branch: `codex/customer-workbench-simple-20260720`
- Baseline: fresh `origin/main` in isolated worktree; original dirty checkout untouched.
- State: implementation and local QA complete; release pending.
- Database: NO-GO because linked migration history is not reproducible locally.
- Safe next action: independent read-only review, scoped commit, fresh remote check, push to main, deploy application only, production smoke.
- Pause trigger: new main commits, unexpected diff, failed reviewer gate, deployment mismatch, or any request to repair/apply database history.

## CP-02 — Independent review complete

- Time: 2026-07-20T02:03:00+02:00
- Review: FLOW PASS, UX PASS, DATA/QA/SEC app-only CONDITIONAL PASS.
- Remediation: fixed cold page restoration, mobile ARIA naming, popup-blocked guidance, and tablet header/action positioning around the desktop sidebar.
- Evidence: focused 6 files / 38 tests, 768px Playwright 1/1, lint, typecheck, and diff check passed.
- Remote state: `origin/main` advanced by two order-detail commits with no overlapping customer files.
- Safe next action: scoped commit, rebase onto current `origin/main`, repeat release gate, push application code only.
