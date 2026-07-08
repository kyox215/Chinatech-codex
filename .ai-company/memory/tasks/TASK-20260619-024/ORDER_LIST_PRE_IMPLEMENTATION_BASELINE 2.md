# Order List Migration Pre-Implementation Baseline

- Task: `TASK-20260619-024`
- Status: baseline passed with one environment-specific sandbox note
- Owner: Integration Lead / CEO Agent
- Date: 2026-06-19 CEST

## Purpose

Establish the current validation baseline before changing order-list business
code. This lets the later migration task distinguish new regressions from
pre-existing dirty-worktree or environment-specific failures.

This task did not edit business code, delete routes, change dependencies, stage,
commit, push, deploy, or touch production data.

## Context

- L2-019 produced the implementation contract:
  `TASK-20260619-023/ORDER_LIST_MIGRATION_IMPLEMENTATION_CONTRACT.md`.
- The active-source legacy route dependency remains:
  `src/features/orders/screens/order-list-screen.tsx` imports
  `@/routes/orders.index`.
- The current worktree is dirty with pre-existing modified/untracked files.
  Validation results must therefore be treated as a baseline for the whole
  current workspace, not a clean committed revision.

## Baseline Command Results

| Gate | Command | Result | Classification |
|---|---|---|---|
| Governance rules | `npm run agents:check` | passed | ready |
| Lint | `npm run lint` | passed | ready |
| TypeScript | `npm run typecheck` | passed | ready |
| Unit tests | `npm run test` | passed: 37 files, 223 tests | ready |
| Build, sandbox | `npm run build` | failed with Turbopack `binding to a port` / `Operation not permitted` | environment-specific sandbox failure |
| Build, non-sandbox | `npm run build` outside sandbox after approval | passed | ready |

## Readiness Conclusion

`PASS-CONDITIONAL` for implementation entry:

- The codebase passes the required pre-implementation gates when `build` is run
  outside the sandbox.
- The sandbox build failure is not classified as a code failure because the same
  command passed outside the sandbox and the failure text was a Turbopack
  port-binding permission error.
- The dirty worktree remains a risk for attribution; the implementation task
  should isolate its diff before interpreting new failures.

## Remaining Open Debt

- `CONFLICT-20260619-004` remains open.
- The single active-source `@/routes` import remains in
  `src/features/orders/screens/order-list-screen.tsx`.
- Actual business-code migration has not started.

## Entry Criteria For L2-021 Code Migration

Start only after the owner explicitly enters business-code implementation.

Before editing, the implementation task should:

1. Read `TASK-20260619-023/ORDER_LIST_MIGRATION_IMPLEMENTATION_CONTRACT.md`.
2. Record current `git status --short`.
3. Preserve the current passing baseline as the expected gate set.
4. Modify only the approved feature-owned files from the contract.
5. Re-run `rg -n 'from "@/routes|@/routes' src`, `npm run lint`,
   `npm run typecheck`, `npm run test`, and `npm run build`.

## No-Go Conditions

Pause and reclassify if:

- API contracts, Supabase migrations, permissions, payment, tenant isolation, or
  order workflow semantics need to change.
- New validation failures appear and cannot be isolated to the implementation
  diff or known environment behavior.
- Route deletion becomes desirable before zero live `@/routes` imports are proven.
