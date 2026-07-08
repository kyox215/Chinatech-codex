# Evidence

## Commands Run

All commands were read-only except creating this task-memory directory and files.

```bash
git status --short
git diff --name-status
git diff --cached --name-status
git ls-files --others --exclude-standard
git diff --check
du -sh .ai-company .agents .codex screenshots exports docs src supabase
git ls-files --others --exclude-standard supabase
```

## Verified Results

- Branch: `main`
- Staged files: 0
- Modified tracked files: 67
- Untracked files: 1248
- `git diff --check`: passed
- Directory sizes:
  - `.ai-company`: 3.6M
  - `.agents`: 172K
  - `.codex`: 124K
  - `screenshots`: 76M
  - `exports`: 59M
  - `docs`: 444K
  - `src`: 3.0M
  - `supabase`: 280K

## Current Untracked Supabase Migrations

```text
supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql
supabase/migrations/20260620120000_customer_interactions_store_id_repair.sql
```

## Screenshot Decision

No screenshot was taken for this execution slice because it is a Git/filesystem cleanup-control task with no related UI page or browser-visible workflow. Alternative evidence is the command-based worktree audit above and the package plan in `WORKTREE_PACKAGE_PLAN.md`.

## Safety Notes

- No files were deleted.
- No files were staged.
- No commit was created.
- No push was performed.
- No Supabase migration was applied.
- No production command was run.

## Package A Preflight

Package A performance preflight was added in `PACKAGE_A_PERFORMANCE_PREFLIGHT.md`.

Result:

- Package A explicit path boundary recorded.
- Package A tracked diff check passed.
- Required untracked support files and screenshots are listed.
- No staging, commit, push, deploy, deletion, or production migration was performed.

## Governance / Memory Validation

Commands:

```bash
npm run agents:check
/opt/homebrew/bin/python3.12 tools/ai_company.py validate
```

Result:

- `npm run agents:check`: passed.
- `tools/ai_company.py validate`: 11 checks, 0 warnings, 0 errors.

## Final Slice Recheck

Commands:

```bash
git status --short
git diff --cached --name-status
git diff --check
find .ai-company/memory/tasks/TASK-20260702-003-worktree-cleanup-execution -type f | sort
```

Result:

- Staged files: 0
- Modified tracked files: 67
- Untracked files after adding this task-memory package: 1254
- Full `git diff --check`: passed
- New task-memory files:
  - `CHECKPOINTS.md`
  - `EVIDENCE.md`
  - `HANDOFF.md`
  - `PACKAGE_A_PERFORMANCE_PREFLIGHT.md`
  - `TASK.md`
  - `WORKTREE_PACKAGE_PLAN.md`
- `2026-07-02T18:13:28Z` `d9c9761e40` — du -sh before/after, git check-ignore, git ls-files, git diff --check

## Local Cache Cleanup - 2026-07-02

This section supersedes the earlier no-deletion safety note for the later
owner-requested local space cleanup slice only.

Pre-cleanup size evidence:

```text
7.5G .
6.3G ./node_modules
878M ./.next
154M ./.git
76M ./screenshots
59M ./exports
```

Root cause:

```text
5.5G node_modules/.cache/rd-next-stale-backups
5.2G node_modules/.cache/rd-next-stale-backups/.next-stale-build-20260618-0739
296M node_modules/.cache/rd-next-stale-backups/.next-stale-build-20260618-0819
845M .next/dev
```

Safety checks before cleanup:

```text
git check-ignore confirmed node_modules, .next, playwright-report,
test-results, tsconfig.tsbuildinfo, and .DS_Store are ignored.

git ls-files for the cleanup targets returned no tracked files.

Repository search found no project references to rd-next-stale-backups.
```

Deleted ignored, untracked, reproducible local cache paths:

```text
node_modules/.cache/rd-next-stale-backups
.next
playwright-report
test-results
tsconfig.tsbuildinfo
.DS_Store
```

Post-cleanup size evidence:

```text
1.2G .
905M node_modules
52K node_modules/.cache
154M ./.git
76M ./screenshots
59M ./exports
```

Preserved:

- Source, docs, migrations, task memory, screenshots, exports, `.env.local`,
  `.vercel`, `.git`, and the usable `node_modules` dependency install.
- No staging, commit, push, deploy, or production database action.

Validation:

```text
git diff --check: passed
```

Screenshot decision:

No screenshot was taken because this was a local filesystem cleanup task with
no related UI page or browser-visible workflow. The substitute evidence is
the disk-usage audit, Git ignore/tracking checks, and diff validation above.
- `2026-07-02T18:14:11Z` `83920448a4` — git diff --check passed; npm run agents:check passed; tools/ai_company.py validate passed; final du -sh evidence recorded in EVIDENCE.md
