# Package A Performance Preflight

Verified on 2026-07-02.

## Purpose

Prepare the performance optimization package for a later explicit-path validation/staging lane. This preflight does not stage, commit, push, or deploy.

## Current Package A Status

Tracked modified files:

```text
src/app/providers.tsx
src/components/command-palette.tsx
src/features/dashboard/screens/dashboard-screen.tsx
src/features/inventory/api/query-keys.ts
src/features/inventory/screens/inventory-screen.tsx
src/features/inventory/server/inventory.repository.ts
src/features/inventory/server/inventory.service.ts
src/features/inventory/testing/mock-api.ts
src/features/orders/api/query-keys.ts
src/features/orders/screens/order-list-screen.tsx
src/lib/mock/api.ts
src/lib/repairdesk/api.ts
src/lib/repairdesk/types.ts
src/server/api/repairdesk-router.ts
src/server/api/repairdesk-schemas.ts
```

Untracked required support files:

```text
src/components/use-command-palette.ts
src/lib/repairdesk/api.test.ts
docs/PERFORMANCE_OPTIMIZATION_PLAN.md
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/
screenshots/TASK-20260701-007-performance-optimization/
```

## Diff Size

Tracked performance source diff:

```text
15 files changed, 1072 insertions(+), 356 deletions(-)
```

Untracked support file sizes:

```text
21  src/components/use-command-palette.ts
177 src/lib/repairdesk/api.test.ts
421 docs/PERFORMANCE_OPTIMIZATION_PLAN.md
```

Evidence screenshot files:

```text
screenshots/TASK-20260701-007-performance-optimization/api-timeout-login-1440.png
screenshots/TASK-20260701-007-performance-optimization/dashboard-summary-1440.png
screenshots/TASK-20260701-007-performance-optimization/inventory-summary-1440.png
screenshots/TASK-20260701-007-performance-optimization/login-production-1440.png
screenshots/TASK-20260701-007-performance-optimization/orders-queue-summary-1440.png
```

Task-memory files:

```text
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/CHECKPOINTS.md
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/EVIDENCE.md
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/HANDOFF.md
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/MEMORY_DELTA.md
.ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan/TASK.md
```

## Checks Completed

```bash
git status --short -- <Package A paths>
git diff --stat -- <Package A tracked paths>
git diff --check -- <Package A tracked paths>
find .ai-company/memory/tasks/TASK-20260701-007-performance-optimization-plan screenshots/TASK-20260701-007-performance-optimization -type f | sort
wc -l src/components/use-command-palette.ts src/lib/repairdesk/api.test.ts docs/PERFORMANCE_OPTIMIZATION_PLAN.md
```

Result:

- Package A path boundary is identifiable.
- Package A tracked diff check passed.
- No Package A staging was performed.

## Recommended Next Step

If the owner wants to move this package toward delivery:

1. Run focused validation for Package A.
2. Stage only the explicit paths listed here.
3. Re-run `git diff --cached --name-status` and `git diff --cached --check`.
4. Commit only after the cached diff exactly matches Package A.
