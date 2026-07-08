# Evidence

Task: TASK-20260620-functional-refactor-export

## Source Evidence Used

- `AGENTS.md`
- `.ai-company/REPAIRDESK_ADOPTION.md`
- `.ai-company/policies/CODEX_OPERATING_MODEL.md`
- `.ai-company/policies/PROJECT_RULES.md`
- `.ai-company/policies/TASK_FLOW.md`
- `.ai-company/memory/ACTIVE_CONTEXT.md`
- `AI智能部门管理/部门化管理设计.md`
- `docs/ARCHITECTURE.md`
- `package.json`
- `supabase/config.toml`
- `.env.example`
- `src/app`
- `src/features`
- `src/server/api`
- `src/lib/repairdesk`
- `supabase/migrations`
- `tests`

## Output Evidence

- `exports/repairdesk-functional-refactor-context-20260620-CEST/`
- `exports/repairdesk-functional-refactor-context-20260620-CEST.zip`

## Verification Evidence

- `find exports/repairdesk-functional-refactor-context-20260620-CEST -maxdepth 1 -type f | sort` showed the six expected Markdown files.
- `wc -l exports/repairdesk-functional-refactor-context-20260620-CEST/*.md` returned `1987 total`.
- `zip -T repairdesk-functional-refactor-context-20260620-CEST.zip` returned `test of repairdesk-functional-refactor-context-20260620-CEST.zip OK`.
- `zipinfo -1 repairdesk-functional-refactor-context-20260620-CEST.zip` showed the package directory and six Markdown files.
- `du -sh` showed `80K` for the export folder and `24K` for the zip archive.

## Screenshot Evidence

No related task page to screenshot.

Reason:

- This task produces documentation and a zip archive, not a changed application page or visual UI state.
- UI/design material was explicitly excluded by the owner.

Alternative evidence:

- File existence checks.
- Markdown content checks.
- Zip archive integrity test.
- `zipinfo` manifest confirmation.
