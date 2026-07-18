# Memory Delta — TASK-20260718-013

## Candidate project rule

When more than one non-terminal task exists, do not use ACTIVE_CONTEXT, cwd, recent Session or modification time as task identity. Require an explicit project/task/run/window binding and keep background checkpoint operations task-local.

Status: candidate until Phase 0A tests and release are complete.

## Candidate architecture decision

Use one project-level SQLite/WAL registry for transactional cross-task identity and claims; keep full task context and evidence in task-specific namespaces with one formal memory writer per task.

Status: candidate ADR until independent review and release.
