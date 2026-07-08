---
schema_version: 1
task_id: TASK-20260701-005-project-garbage-cleanup
status: closed
owner: Hexiang Huang / 鹤祥
lead: CEO Agent / RepairDesk Integration Lead
created_at: 2026-07-01T22:50:46+02:00
closed_at: 2026-07-01T22:53:14+02:00
risk_level: R1
autonomy_level: L2
task_type: repo_cleanup_and_inventory
---

# TASK-20260701-005 Project Garbage Cleanup

## Owner Goal

老板原始任务：`读取项目并为我梳理项目垃圾信息文件等 帮我清理优化项目`

## Business Value

Reduce local repository clutter, recover disk space from generated artifacts, and give the Owner a clear inventory of safe-to-delete files versus important untracked project evidence.

## Scope

In scope:

- Inspect project status, ignore rules, generated outputs, caches, large files, and obvious OS/build artifacts.
- Delete only safe, ignored, regenerable artifacts in the first pass.
- Add ignore rules for repeated Python cache files if needed.
- Preserve task evidence, screenshots, exports, governance memory, migrations, business code, dependencies, and secrets.
- Record cleanup evidence and a follow-up risk list.

Out of scope:

- Deleting business source files, task screenshots, export deliverables, `.ai-company` governance files, `.agents` skills, Supabase migrations, `.env*`, `.vercel`, or `node_modules`.
- Git staging, commit, push, deployment, production data changes, dependency upgrades, or broad refactors.
- Deleting ambiguous untracked files without explicit Owner approval.

## Classification

- Complexity: T1/T2 cleanup with dirty-worktree risk.
- Risk: R1 for generated ignored artifacts; R2+ for any ambiguous source/evidence deletion, therefore deferred.
- Autonomy: L2 controlled execution for safe ignored artifacts only.
- Departments considered: INT, DOC/RULES, QA.
- Spawn plan: no real sub-agents spawned.
- No-spawn reason: the Owner did not explicitly request sub-agents; available multi-agent tool guidance allows spawning only on explicit delegation requests. Main-thread cleanup is sufficient for the safe first pass.

## Acceptance Criteria

- Clear inventory of generated artifacts, obvious junk, and preserved non-junk untracked areas.
- Safe ignored build/test/cache artifacts removed.
- `.gitignore` prevents recurring Python cache junk.
- Validation proves project governance still parses after cleanup.
- Final report states no UI screenshot reason because this is a filesystem cleanup task.

## Cleanup Policy

Delete now:

- `.next/`
- `dist/`
- `storybook-static/`
- `playwright-report/`
- `test-results/`
- `tsconfig.tsbuildinfo`
- `.DS_Store` files
- `tools/__pycache__/`

Preserve:

- `node_modules/` to keep local tests/dev usable.
- `screenshots/` as task visual evidence.
- `exports/` as deliverables.
- `.ai-company/`, `.agents/`, `.codex/` as governance and memory.
- `supabase/migrations/*`, `src/*`, `docs/*`, tests, and task files.

## Verification Plan

- Re-run ignored artifact checks.
- Run `npm run agents:check`.
- Run `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`.
- Run scoped `git diff --check` on changed tracked files and task memory.

## Verification Results

- `npm run agents:check`: passed.
- `/opt/homebrew/bin/python3.12 tools/ai_company.py validate`: passed with 11 checks, 0 warnings, 0 errors.
- `git diff --check -- .gitignore`: passed.
- Re-scan confirmed first-pass generated directories, `.DS_Store`, and `__pycache__` were removed.

## Closeout

Final status: closed.

No screenshot required because this is a filesystem cleanup and repository hygiene task, not a UI/browser-visible change.
