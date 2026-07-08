# Evidence

| ID | Type | Evidence | Result | Timestamp |
|---|---|---|---|---|
| E-001 | inventory | `git status --short` | Worktree is heavily dirty with many existing modified and untracked source, docs, governance, screenshot, export, and migration files. | 2026-07-01 |
| E-002 | size | `du -sh .next dist storybook-static playwright-report test-results screenshots exports node_modules .ai-company .agents .codex tools` | `.next` 2.5G, `node_modules` 6.3G, screenshots 72M, exports 59M, other generated outputs small. | 2026-07-01 |
| E-003 | ignore-check | `git check-ignore -v .next dist storybook-static playwright-report test-results tsconfig.tsbuildinfo .DS_Store ...` | `.next`, `dist`, Storybook, Playwright report, test results, tsbuildinfo, `.DS_Store`, and node_modules artifacts are ignored. | 2026-07-01 |
| E-004 | tracked-check | `git ls-files .next dist storybook-static playwright-report test-results tsconfig.tsbuildinfo tools/__pycache__ .DS_Store ...` | No output; cleanup candidates are not tracked. | 2026-07-01 |
| E-005 | obvious-junk | `find . ... -name '*.log' -o -name '*.tmp' -o -name '*.bak' -o -name '*.orig' -o -name '.DS_Store' -o -name '*.tsbuildinfo' -o -name '*.pyc'` | Found `tools/__pycache__/ai_company.cpython-312.pyc`, root `.DS_Store`, and `tsconfig.tsbuildinfo` outside pruned generated directories. | 2026-07-01 |
| E-006 | cleanup | `rm -rf .next dist storybook-static playwright-report test-results tsconfig.tsbuildinfo .DS_Store tools/__pycache__ node_modules/.DS_Store node_modules/next/dist/.DS_Store` | Safe ignored generated artifacts and macOS/cache files removed. | 2026-07-01 |
| E-007 | post-cleanup | `find . -maxdepth 2 -type d (...)`; `find . -name .DS_Store`; `find . ... -name __pycache__` | No first-pass generated directories, `.DS_Store`, or `__pycache__` remained. | 2026-07-01 |
| E-008 | ignore-update | `.gitignore` | Added `__pycache__/` and `*.pyc`. | 2026-07-01 |
| E-009 | validation | `npm run agents:check` | Passed; Agent config, template, and rule checks passed. | 2026-07-01 |
| E-010 | validation | `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` | Passed; 11 checks, 0 warnings, 0 errors. | 2026-07-01 |
| E-011 | validation | `git diff --check -- .gitignore` | Passed; no whitespace errors in changed tracked file. | 2026-07-01 |
| E-012 | large-files | `find . ... -type f -size +10M -print` | Only `exports/repairdesk-orders-ui-redesign-20260620-010803-CEST.zip` remained outside pruned dependency/build directories; preserved as deliverable. | 2026-07-01 |

## Visual Evidence

No screenshot required. This task is filesystem cleanup and repository hygiene, with no browser-visible page or UI state.
