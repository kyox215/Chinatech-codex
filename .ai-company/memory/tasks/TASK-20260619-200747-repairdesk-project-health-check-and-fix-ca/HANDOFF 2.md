# Handoff / Resume — TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca

## Current handoff

- **Status:** complete.
- **Last verified:** 2026-06-19T20:18:00Z
- **Workspace/branch:** inspect before resuming.
- **First action:** read `TASK.md`, `EVIDENCE.md`, and latest checkpoint, then inspect the repository.

## Summary

Project health gates are currently green, with one safe developer-experience fix applied in `next.config.ts`. The main remaining risks are cleanup and architecture hygiene rather than immediate runtime failures: broad dirty worktree, duplicate `* 2.*` files, incomplete App Router migration for the orders list, and several very large modules.

## Verified Commands

- `npm run agents:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build` outside sandbox
- `npm run test:e2e` outside sandbox
- `npm run knip` as advisory

## Recommended Follow-up Order

1. Explicit duplicate-file cleanup batches, starting from known stale `* 2.*` files.
2. Dependency hygiene after duplicates are gone: confirm `recharts`, `ws`, and Knip unused exports.
3. Migrate `src/routes/orders.index.tsx` into real `src/features/orders/screens` ownership.
4. Split large modules by stable boundaries: order detail, buyback quote workspace, order overview, API router/schema.
