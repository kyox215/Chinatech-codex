# Handoff / Resume — TASK-20260619-003

## Current handoff

- **Status:** takeover baseline ready for closeout.
- **Last verified:** 2026-06-19T12:54:37Z
- **Workspace/branch:** worktree is dirty and contains 99 `* 2.*` duplicate files; inspect before any code work.
- **First action:** read `PROJECT_TAKEOVER_REPORT.md`, `EVIDENCE.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.

## Resume packet

- No business code was changed by this takeover.
- Current gates passed: `agents:check`, v3 validate, lint, typecheck, unit tests, build outside sandbox.
- Highest open risks: dirty worktree / duplicate files, legacy `src/routes/orders.index.tsx` live dependency, unverified production Supabase/Vercel state, large high-blast-radius modules, unknown PII/backup/retention policy.
- First recommended L2 tasks: duplicate-file inventory, permission matrix document, legacy routes migration plan, stale docs audit, production readiness checklist, health-check runbook.
- Do not delete duplicate files, run production SQL, change permissions, deploy, or send external communication without owner approval.
