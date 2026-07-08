# Handoff / Resume — TASK-20260619-005

## Current handoff

- **Status:** review complete; conditional closeout due full validator traversal limitation.
- **Last verified:** 2026-06-19T19:06:39Z
- **Workspace/branch:** inspect before resuming; dirty worktree pre-existed this task and includes many untracked duplicate files.
- **Primary artifact:** `DIFFERING_DUPLICATES_REVIEW.md`
- **Boundary:** do not delete, merge, stage, revert, or edit duplicate/business-code files without Owner approval.
- **Validation:** `npm run agents:check` passed. Full `/opt/homebrew/bin/python3.12 tools/ai_company.py validate` was attempted but interrupted after prolonged no-output traversal; stack trace showed `root.rglob("*.md")`.
- **First action if resuming:** do not repeat cleanup analysis from scratch; either ask the Owner to approve a cleanup batch or create a tooling task to optimize `tools/ai_company.py validate` traversal.

## Decision package

- Batch A: remove after Owner confirmation: report rows #1-7, #9-16, #26-28.
- Batch B: remove after domain/data confirmation: report rows #17-25, #29-31.
- Batch C: backlog/salvage only: report rows #8 and #32.

## Recommended next tasks

- `L2-003`: Owner-approved deletion of Batch A identical/stale duplicates only, with pre/post `git status` and targeted checks.
- `L2-004`: Domain confirmation for order workflow/data migration semantic conflicts before deleting Batch B.
- `L2-005`: Optional tooling task to make `tools/ai_company.py validate` prune ignored/generated directories before `rglob` traversal.
