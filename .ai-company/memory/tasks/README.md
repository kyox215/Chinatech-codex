# Task Memory

Each non-trivial task uses a dedicated directory:

```text
TASK-YYYYMMDD-HHMMSS-slug/
├── TASK.md          objective, scope, risk, autonomy, acceptance criteria
├── CHECKPOINTS.md   append-only recoverable state summaries
├── EVIDENCE.md      tests, logs, screenshots, commits, files, approvals
├── MEMORY_DELTA.md  candidates for long-term consolidation
└── HANDOFF.md       handoff and resume records
```

Create tasks with `python tools/ai_company.py new-task ...`. Do not reuse a task
ID for a different objective.
