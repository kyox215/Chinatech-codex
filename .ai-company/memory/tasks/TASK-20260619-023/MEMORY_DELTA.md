# Memory Delta — TASK-20260619-023

## Candidate project facts

- `TASK-20260619-023` produced an implementation-ready contract for migrating the order list out of `src/routes/orders.index.tsx`.
- No business code was modified by this planning task.
- The later code task should be behavior-preserving and feature-owned, with target files under `src/features/orders/screens`, `src/features/orders/components`, `src/features/orders/model`, and optionally `src/features/orders/api/query-keys.ts`.

## Candidate department updates

- Architecture should record that the order-list migration now has a concrete implementation contract and file ownership plan.
- Documentation should record the planning artifact as the current execution guide for the next code task.

## Candidate decisions / ADRs

- Recommended implementation option: feature-owned extraction with behavior preservation, not one-file copy, big-bang redesign, or same-task route deletion.
- Keep `CONFLICT-20260619-004` open until a later implementation removes active-source `@/routes` imports.

## Candidate lessons and capability evidence

- Large legacy route migration should use a contract and staged slices before write work begins.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.

## Sync status

- Project memory, memory index, architecture memory, documentation memory, backlog, open-conflict records, task evidence, and handoff were synchronized.
- Validation evidence: `EVIDENCE.md` E-009 and E-010.
