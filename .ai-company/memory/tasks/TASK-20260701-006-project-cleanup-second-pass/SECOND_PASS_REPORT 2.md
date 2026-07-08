# Project Cleanup Second-Pass Report

Task ID: `TASK-20260701-006-project-cleanup-second-pass`
Date: 2026-07-01 CEST

## Key Finding

Do not use blanket `git clean` in this repository right now.

- `git clean -ndX` would remove important local state such as `.env.local`, `.vercel/`, and `node_modules/`.
- `git clean -nd` would remove untracked but important project work such as `.ai-company/`, screenshots, exports, migrations, source files, and tools.

Cleanup must stay explicit-path only.

## Confirmed Safe Deletions

| Path | Reason |
|---|---|
| `.ai-company/memory/tasks/TASK-20260619-234449-l2-030-audit-project-for-similar-governanc/MEMORY_DELTA 2.md` | Older empty duplicate; canonical `MEMORY_DELTA.md` has real content. |
| `.tanstack/` | Empty ignored legacy/tooling directory. |
| `.wrangler/` | Ignored local Cloudflare/Wrangler cache/config directory; no active project source depends on it in this pass. |

## Preserved Candidates Requiring Owner Approval

| Path | Reason |
|---|---|
| `.env.local` | Sensitive local environment file. |
| `.vercel/` | Local Vercel project linkage. |
| `supabase/.temp/` | Local Supabase link/version/cache data; small and useful for local Supabase CLI context. |
| `.ai-company/state/runtime.json` | Ignored runtime state; small and tied to AI Company OS local execution. |
| `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST.zip` | Owner-facing export artifact. |
| `screenshots/` | Visual evidence required by project rules. |
| `node_modules/` | Large but keeps dev/test usable without reinstall. |
