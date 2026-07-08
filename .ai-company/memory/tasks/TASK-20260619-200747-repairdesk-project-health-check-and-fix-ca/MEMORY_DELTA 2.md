# Memory Delta — TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca

## Candidate project facts

- Health gate baseline on 2026-06-19: `agents:check`, `lint`, `typecheck`, `test`, non-sandbox `build`, and `test:e2e` passed. Source: E-004 through E-009. Status: verified.
- Worktree remains dirty and broad; use explicit-path staging and avoid blanket cleanup. Source: E-002. Status: verified.
- 76 duplicate-like `* 2.*` files remain outside ignored generated directories. Source: E-003. Status: verified cleanup backlog.
- `/orders` list still imports `@/routes/orders.index`; App Router migration is incomplete in that specific path. Source: E-011. Status: verified architecture debt.

## Candidate department updates

- QA: Treat Knip as advisory until duplicate files are removed; it currently reports many false positives from `* 2.*` files.
- Frontend: `next.config.ts` allows `127.0.0.1` dev origin for Playwright/Next dev HMR compatibility.
- Architecture: Large files over 1.5k lines should be extracted through feature-owned slices with tests, not wholesale rewrites.

## Candidate decisions / ADRs

- None yet.

## Candidate lessons and capability evidence

- A proportional project health check can run full gates even in a dirty worktree, but build/e2e need non-sandbox execution because local Next/Turbopack server binding is blocked in sandbox.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
