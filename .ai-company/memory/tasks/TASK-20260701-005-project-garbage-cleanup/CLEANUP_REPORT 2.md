# Project Garbage Cleanup Report

Task ID: `TASK-20260701-005-project-garbage-cleanup`
Date: 2026-07-01 CEST
Owner: Hexiang Huang / 鹤祥
Lead: CEO Agent / RepairDesk Integration Lead

## Summary

The first cleanup pass removed only ignored, untracked, regenerable artifacts. No business code, migrations, task screenshots, exports, governance files, dependencies, secrets, staging, commits, pushes, deployments, or production data were touched.

## Deleted In This Pass

| Path | Reason | Safety basis |
|---|---|---|
| `.next/` | Next.js build/dev cache; measured at about 2.5G before cleanup. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `dist/` | Generated build output. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `storybook-static/` | Generated Storybook output. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `playwright-report/` | Generated Playwright report. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `test-results/` | Generated Playwright/test output. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `tsconfig.tsbuildinfo` | TypeScript incremental cache. | Ignored by `.gitignore`; not Git-tracked; rebuildable. |
| `.DS_Store` files | macOS system metadata. | Ignored by `.gitignore`; not Git-tracked; no project value. |
| `tools/__pycache__/` | Python bytecode cache from local tooling. | Not Git-tracked; rebuildable. |

## Changed Files

| Path | Change |
|---|---|
| `.gitignore` | Added `__pycache__/` and `*.pyc` to stop Python cache files from reappearing as untracked junk. |
| `.ai-company/memory/tasks/TASK-20260701-005-project-garbage-cleanup/*` | Added task memory, evidence, checkpoints, handoff, memory delta, and this report. |

## Preserved By Design

| Path/category | Reason preserved |
|---|---|
| `node_modules/` | Large at about 6.3G, but required for local dev/test without reinstalling. |
| `screenshots/` | Task visual evidence required by project rules. |
| `exports/` | Owner-facing deliverables; one ZIP is larger than 10M and should be archived/deleted only with explicit approval. |
| `.ai-company/`, `.agents/`, `.codex/` | Governance, skills, memory, and agent definitions. |
| `supabase/migrations/` | Database history and pending migration evidence. |
| `src/`, `docs/`, `tests/`, `scripts/`, `tools/ai_company.py` | Source, docs, tests, scripts, and project tooling. |
| `.env*`, `.vercel/` | Sensitive/local environment and deployment linkage; not reviewed or modified. |

## Post-Cleanup Inventory

- Total repository directory size after cleanup: about 6.7G.
- Largest remaining local area: `node_modules/` at about 6.3G.
- Evidence/deliverables retained: `screenshots/` about 72M, `exports/` about 59M.
- No generated directories from the first-pass list remained after cleanup.
- No `.DS_Store` or `__pycache__` directories remained after cleanup.

## Remaining Cleanup Candidates

These are not safe for automatic deletion in this pass:

| Candidate | Why not deleted |
|---|---|
| `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST.zip` | Likely a deliverable/export artifact; requires Owner approval or archive policy. |
| Old screenshot folders under `screenshots/` | Required task evidence unless a retention policy is approved. |
| Large dirty-worktree source/doc changes | They appear to be active RepairDesk work; cleanup must be scoped task-by-task. |
| `node_modules/` | Can be deleted only if the Owner accepts reinstall cost and temporary loss of local dev/test readiness. |

## Verification

- `npm run agents:check`: passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`: passed with 11 checks, 0 warnings, 0 errors.
- `git diff --check -- .gitignore`: passed.
