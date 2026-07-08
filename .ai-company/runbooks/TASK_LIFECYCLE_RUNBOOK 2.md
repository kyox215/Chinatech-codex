# Task Lifecycle Runbook

## Purpose

Operate a task from owner request through verified closeout without losing scope,
evidence, approvals, or durable learning.

## Entry conditions

- An owner goal exists.
- The repository root and applicable `AGENTS.md` are known.
- For non-trivial work, a task ID will be created.

## Procedure

### 1. Intake

1. Run `$context-rehydrate` when resuming an existing project.
2. Run `$company-task-intake`.
3. Create the task:

```bash
python tools/ai_company.py new-task \
  --title "<goal>" --task-class T1 --risk R1 --autonomy L2 \
  --acceptance "<observable result>"
```

4. Separate facts, assumptions, unknowns, constraints, and preferences.
5. Do not implement until the completion definition can be tested.

### 2. Classify and organize

1. Run `$risk-autonomy-classify`.
2. Identify D1/D2 delegated decisions and D3/D4 approval points.
3. Run `$agent-team-compose` only when independent work packages exist.
4. For T2/T3, create 2–4 read-only specialists before the writer.

### 3. Plan

1. Run `$task-plan-and-contract`.
2. Map each acceptance criterion to evidence.
3. Define file scope, compatibility, tests, migration, rollback, and stop conditions.
4. Obtain approvals before retained decisions or irreversible steps.

### 4. Implement

1. Inspect Git status and preserve user changes.
2. Use one `implementer` for application-code writes.
3. Work in small, verifiable increments.
4. Stop on scope growth, hidden coupling, security/data risk, or plan invalidation.
5. Create a checkpoint after a material increment.

### 5. Independently review

Select applicable gates:

- `$quality-gate`
- `$security-review`
- `$data-migration-review`
- `$ui-ux-review`
- `$release-governance`

Reviewer findings return to the single writer for fixes. Reviewer and author must
not silently collapse into one role on high-risk work.

### 6. Consolidate and close

1. Run `$documentation-sync`.
2. Run `$memory-consolidation` and `$department-memory-sync`.
3. Run `$capability-review` for material successes, failures, or repeated work.
4. Run `$task-closeout`.
5. Close via CLI only after evidence and dirty-state checks:

```bash
python tools/ai_company.py close-task --task <TASK_ID> --outcome "<verified result>"
```

## Exit conditions

- Acceptance criteria have evidence.
- Required approvals and gates are recorded.
- Residual risk has an owner and deadline.
- Project/department/task memory is synchronized.
- ACTIVE_CONTEXT is idle or points to the next explicit task.
