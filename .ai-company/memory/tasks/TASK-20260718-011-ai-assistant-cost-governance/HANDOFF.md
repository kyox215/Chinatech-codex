# Handoff / Resume — TASK-20260718-011-ai-assistant-cost-governance

## Current handoff

- **Status:** release candidate; conditional closeout not yet recorded.
- **Last verified:** 2026-07-18T19:23:24Z.
- **Workspace/branch:** isolated worktree `/private/tmp/repairdesk-ai-assistant.tqlBEu/worktree`; branch `codex/ai-assistant-cost-governance-20260718`; latest integrated baseline `origin/main@9465ead4`.
- **Completed:** Phase 3A1–3A4 implementation, PostgreSQL 17 migration proof, latest-main rebase, full local gates, fake-provider browser coverage and synthetic screenshots.
- **First action if resumed before release:** inspect Git status and `origin/main`; repeat rebase/gates if main advanced. Then run final reviewers, production env-name-only preflight, non-force push, dormant deploy and exact-SHA smoke.
- **Hard stops:** do not read/copy/sync a key, apply the migration, seed a policy, enable any AI/OpenAI variable or send real text/image/PII.
- **Rollback:** keep AI flags absent/off; use the previous READY Vercel deployment; revert scope commits if needed; do not emergency-drop unapplied additive tables.
