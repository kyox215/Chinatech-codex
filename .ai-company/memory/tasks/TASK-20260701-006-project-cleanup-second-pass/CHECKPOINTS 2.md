# Checkpoints

## 2026-07-01T22:59:41+02:00 Second-Pass Intake

- Continued from `TASK-20260701-005-project-garbage-cleanup`.
- Confirmed blanket `git clean -nd` and `git clean -ndX` are unsafe in this dirty worktree.
- Identified one stale duplicate memory file and two tiny local cache/empty directories for safe deletion.

## 2026-07-01T23:00:38+02:00 Closed

- Removed `MEMORY_DELTA 2.md`, `.tanstack/`, and `.wrangler/`.
- Preserved `.env.local`, `.vercel/`, `supabase/.temp/`, `.ai-company/state/runtime.json`, exports, screenshots, `node_modules/`, source, migrations, and governance files.
- Validation passed: `npm run agents:check`, `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`, and scoped `git diff --check`.
