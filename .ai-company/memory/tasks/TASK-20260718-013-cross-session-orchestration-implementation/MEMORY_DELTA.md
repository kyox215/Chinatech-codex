# Memory Delta — TASK-20260718-013

## Candidate project rule

When more than one non-terminal task exists, do not use ACTIVE_CONTEXT, cwd, recent Session or modification time as task identity. Require an explicit project/task/run/window binding and keep background checkpoint operations task-local.

Status: promoted as an active project rule in `PROJECT_MEMORY.md`, `MEMORY_INDEX.md`, the project declaration, and Architecture/Memory/Operations/Documentation/QA/Security department memory. The rule remains Phase 0A cooperative shadow scope.

## Candidate architecture decision

Use one project-level SQLite/WAL registry for transactional cross-task identity and claims; keep full task context and evidence in task-specific namespaces with one formal memory writer per task.

Status: approved by Owner instruction and promoted as ADR-20260718-002 after three independent GO reviews, 46/46 tests and verified non-force `main@ffddbb35` publication.

## Capability result

`CAP-CROSS-SESSION-20260718` remains C1/provisional. This single release proves a bounded implementation and review cycle, not mature autonomous operation. Permission and autonomy remain unchanged; review after Phase 0B or three real parallel-task pilots.

## Not promoted

Temporary worktree paths, intermediate rebase SHAs, command IDs and packet file paths are task evidence only because they are not durable project rules.
