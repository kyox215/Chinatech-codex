# Memory Recovery and Long-Context Runbook

## Trigger

Use at session start, after compaction, after a long interruption, when another
Agent/person takes over, or whenever the model appears to have lost context.

## Recovery sequence

1. Read the nearest applicable `AGENTS.md` chain.
2. Read `ACTIVE_CONTEXT.md`, `PROJECT_MEMORY.md`, and `OPEN_CONFLICTS.md`.
3. Identify `current_task_id` and read that task's `TASK.md`, latest checkpoints,
   evidence, and handoff.
4. Inspect real Git status/diff and relevant code before trusting status claims.
5. Generate a bounded Context Packet:

```bash
python tools/ai_company.py context --task <TASK_ID> --output .ai-company/state/context_packet.md
```

6. Classify each important statement:
   - verified/approved;
   - observed but not independently verified;
   - inferred;
   - proposed;
   - stale/disputed.
7. Revalidate high-impact facts: target environment, permissions, migration
   status, current branch, tests, external side effects, and approvals.
8. Record any contradiction in `OPEN_CONFLICTS.md`.
9. Create a resume checkpoint before new writes.

## Compression rules

Preserve:

- owner objective and acceptance criteria;
- safety/legal/business constraints;
- risk/autonomy and approval points;
- current phase, completed work, open blockers;
- exact evidence paths and next action;
- unresolved conflicts and rollback constraints.

Compress or omit:

- repeated conversation;
- discarded brainstorming with no decision value;
- raw logs when a stable artifact path exists;
- personality narrative and hidden reasoning;
- secrets and unnecessary personal data.

## Failure handling

When task memory is missing or corrupt:

1. Stop writes.
2. Use Git history, issue/PR records, tests, build output, and owner instruction to
   reconstruct an evidence-backed checkpoint.
3. Mark reconstructed claims `observed` until independently verified.
4. Create a memory incident if the loss affects safety, audit, or recovery.
