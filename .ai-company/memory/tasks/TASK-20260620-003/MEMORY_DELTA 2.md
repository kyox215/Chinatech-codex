# Memory Delta — TASK-20260620-003

## Candidate project facts

- `TASK-20260620-003` converted the `TASK-20260620-002` classification into an executable, approval-gated deletion preflight contract. No `src/routes/*` files were deleted.
- The current preflight baseline still shows six legacy `src/routes/*` files, no active source references outside `src/routes`, and a stale `knip.json` ignore entry that should be removed only after the directory is deleted.
- Non-destructive preflight validation passed: `npm run agents:check`, `npm run lint`, `npm run typecheck`, `knip.json` JSON parse, active legacy route scan, and route-file existence recheck.

## Candidate department updates

- Architecture: future deletion task has exact file scope and stop conditions; keep "no `@/routes` reintroduction" invariant.
- Frontend: route deletion must not touch App Router or feature screen files.
- QA: future deletion gate requires route scans, JSON parse for `knip.json`, agents check, lint, typecheck, test, and build.
- Documentation: memory/docs should move to "deleted and validated" only after a separate deletion task passes gates.

## Candidate decisions / ADRs

- Proposed, not approved: start a separate L2 cleanup task to delete the six classified legacy route files and remove stale `knip.json` ignore entry.

## Candidate lessons and capability evidence

- Preflight contracts are useful before destructive source cleanup: they preserve approval boundaries while making the eventual deletion mechanically executable.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
