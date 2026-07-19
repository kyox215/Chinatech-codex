# Checkpoints — TASK-20260719-007

## 2026-07-19T19:09:28Z — Intake and isolated baseline

- Owner approved implementation, push and production deployment.
- Goal created in the active Codex thread.
- Risk classified T3/R4/L1; production read-only exact-SHA release approved, migrations/secrets/writes excluded.
- Root checkout preserved; isolated worktree created from `origin/main@25752bd1` on `codex/ai-nlq-v3-20260719`.
- Three bounded read-only reviewers spawned; Integration Lead remains sole writer.
- Next: implement WP-01/WP-02 and run exact semantic regression before UI changes.

## 2026-07-19T20:13:30Z — Implementation and release-candidate validation

- Order Query contract upgraded to v3; Europe/Rome date engine now supports valid absolute/open/range/rolling/calendar/month/year/quarter/all-history expressions.
- Server reconciliation is closed-world: provider output is advisory and cannot invent device, date, scope, finance, status or payment constraints.
- Device boundary rules map Apple 15 series without matching Samsung, iPhone 14 or iPhone 150.
- Compact sheet now separates processing mode from interpretation status; usage and query scope are collapsible; result cards stay actionable in the sheet.
- Focused 156 tests, final lint/typecheck, 311 files / 2,028 tests, Webpack production build and two core browser scenarios passed.
- Responsive browser inspection passed at 390/430/768/1280 with no console error and screenshots saved.
- Serial full-file Playwright on Next dev exposed a pre-existing/dev-only hydration stall after repeated contexts; core changed scenarios pass in independent workers. Production E2E bypass is intentionally forbidden, so release evidence relies on production build plus bounded browser smoke.
- Memory checkpoint completed with the exact dirty scope, verification evidence, open tooling note, release authority and rollback boundary; no secret or customer data was stored.
- Next: freeze diff, commit exact scope, fetch/rebase gate, non-force push `HEAD:main`, verify exact-SHA Vercel production deployment and no-PII smoke.

## 2026-07-19T20:20:03Z — Latest-main integration gate

- `origin/main` advanced by three fast-recovery commits during validation; their file set did not overlap this task.
- The single AI query commit rebased cleanly onto `origin/main@1119ef5d`.
- On the rebased candidate, lint, typecheck, 311 files / 2,033 tests and Webpack production build all passed; worktree is clean and exactly one commit ahead.
- Next: one final fetch/fast-forward assertion, non-force push `HEAD:main`, then exact-SHA Vercel and production smoke verification.
