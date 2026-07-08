# Memory Delta

## Candidate Project Memory

The RepairDesk checkout accumulates large ignored generated artifacts, especially `.next/`. Safe cleanup can delete `.next/`, `dist/`, `storybook-static/`, `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo`, `.DS_Store`, and Python `__pycache__` after confirming they are not Git-tracked. Do not classify screenshots, exports, `.ai-company`, `.agents`, `.codex`, migrations, or untracked feature/source files as garbage without a separate approval package.

## Candidate Documentation Memory

`.gitignore` should include Python cache patterns (`__pycache__/`, `*.pyc`) because `tools/ai_company.py validate` can create `tools/__pycache__/`.
