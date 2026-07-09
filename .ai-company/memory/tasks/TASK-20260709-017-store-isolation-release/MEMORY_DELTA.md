# Memory Delta — TASK-20260709-017-store-isolation-release

## Candidate project facts

- Router-level write permission gates now use the central `src/server/permissions.ts` matrix for customer writes, order payments/transitions, workflow/store/message-template settings, member operations, and inventory writes. Source: commit `72e3bdc4` / task evidence E-009..E-018. Status: implemented and pushed; review when adding new repairdesk router mutations.
- This task did not add or apply Supabase DDL. Historical migration drift remains a separate reconciliation concern; do not use broad `supabase db push` or `--include-all` to satisfy future migration requests. Source: task evidence E-005/E-016. Status: active caution; review before any Supabase migration task.

## Candidate department updates

- API/SECURITY: New store-scoped write routes should call an explicit `assert*Permission` helper or `assertRepairDeskPermission` before service execution, not rely only on repository store filtering.
- DATA/RELEASE: If a code slice has no migration file, the database step should be recorded as verified/no-op rather than applying unrelated pending historical migrations.

## Candidate decisions / ADRs

- Decision: For this store-isolation release slice, object-scope read permissions and sensitive field projection/export/unlock/attachment controls were deferred to a separate phase to avoid over-tightening read/list routes before scoped object assignments are modeled.

## Candidate lessons and capability evidence

- Rebase/push note: `origin/main` advanced during push with supplier permission commits, causing a non-fast-forward rejection and an `ACTIVE_CONTEXT.md` rebase conflict. Safe resolution was fetch, rebase, preserve current task context, rerun lint/typecheck/test/build, and push fast-forward.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
