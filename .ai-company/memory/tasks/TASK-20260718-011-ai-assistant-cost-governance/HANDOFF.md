# Handoff / Resume — TASK-20260718-011-ai-assistant-cost-governance

## Current handoff

- **Status:** conditional closeout; dormant/default-off Phase 3A is released, while paid/live/migration/privacy activation remains blocked.
- **Last verified:** 2026-07-18T20:10:17Z.
- **Workspace/branch:** isolated worktree `/private/tmp/repairdesk-ai-assistant.tqlBEu/worktree`; recovery branch `codex/ai-assistant-cost-governance-20260718`; final remote `main@d84dae86` contains reviewed scope `2a917a00`.
- **Completed:** Phase 3A1–3A5 implementation, PostgreSQL 17 migration proof without apply, 296 files / 1858 tests, 26-page Webpack build, fake-provider browser coverage, three final P0=0/P1=0 reviews, non-force Git push, READY production deploy, anonymous auth/API smoke and zero error/fatal/5xx observation.
- **Production:** `dpl_8nFPJjX3dY7Xbh9KTxBCdc5wRVfF`, `www.chinatech.in`, READY, final Git SHA `d84dae86`; exact-scope deployment `dpl_8VBRyFn5WZ9k4YKt25ACkaQ1AEPC` proves `2a917a00`.
- **First action if resumed for paid/live work:** create a new R4 task and obtain Owner D4 decisions for budget, privacy/vendor terms, key handling, migration apply/policy seed, distributed limits, retention and activation. Do not resume by merely changing Vercel flags.
- **Hard stops:** do not read/copy/sync a key, apply the migration, seed a policy, enable any AI/OpenAI variable or send real text/image/PII.
- **Rollback:** keep AI flags absent/off; use pre-scope READY `dpl_FueK1juPvAp8UJrE1FdvPxRYRy4o` / `main@de5f8b49`; revert scope commits if needed; do not emergency-drop unapplied additive tables.
