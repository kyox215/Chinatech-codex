# Memory Delta — TASK-20260619-004

## Candidate project facts

- Current duplicate inventory is more complete than the earlier quick count: 104 Git-visible duplicate files, 14 Git-visible empty duplicate directories, and 11 ignored/generated Storybook duplicate-like paths. Source: `DUPLICATE_WORKTREE_INVENTORY.md`. Status: accepted for project memory.
- Of the Git-visible duplicate files, 72 are byte-identical to canonical counterparts and 32 differ. Source: SHA-256 comparison in read-only scanner. Status: accepted for project memory.
- The dirty worktree includes 12 tracked modified files, including governance files and business/UI files. Source: `git diff --name-status`. Status: open risk; do not attribute or alter in cleanup inventory.

## Candidate department updates

- QA/Operations should treat identical duplicate files and empty duplicate dirs as cleanup candidates only after owner confirmation.
- Architecture/Frontend/Data should review the 32 different duplicate files before deletion because several touch orders, inventory, auth, shared UI, migrations, and tests.

## Candidate decisions / ADRs

- No deletion approved or performed.
- No staging, commit, revert, or business-code edit performed.

## Candidate lessons and capability evidence

- Quick `rg --files -g '* 2.*'` under-counted duplicates because hidden `.cursor` paths and duplicate directories were not included. Future cleanup inventories should use filesystem scan plus Git ignore status and content hashes.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
