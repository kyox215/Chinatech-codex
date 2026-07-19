# Handoff / Resume — TASK-20260719-006-ai-natural-language-order-actions

## Current handoff

- **Status:** release ready; production release evidence still pending.
- **Last verified:** 2026-07-19T17:16:00Z
- **Workspace/branch:** `/private/tmp/repairdesk-ai-natural-order-actions-20260719`,
  `codex/ai-natural-order-actions-20260719`.
- **Verified:** agents check, lint, typecheck, 2,017 Vitest cases, webpack build and all 11 AI
  E2E cases passed. Five synthetic-data screenshots are in the task screenshot directory.
- **Safety state:** no migration; `AI_ORDER_INLINE_ACTIONS_ENABLED=0` must remain production-off.
- **First action:** refresh `origin/main`, verify ancestry/diff, commit scoped files, push main without
  force, deploy exact SHA, then run non-mutating production page/API smokes.
- **Stop condition:** any main divergence, secret/PII exposure, unexpected production env change,
  failed build/deploy, cross-store result, or evidence that the inline-write flag is enabled.
