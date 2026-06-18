# Scoped Write Handoff

```txt
department:
mode: scoped_write
allowed_files:
changed_files:
summary:
tests_run:
tests_not_run:
risks:
follow_up:
```

Rules:

- The worker must not stage, commit, push, deploy, or run destructive commands.
- The worker must not touch files outside `allowed_files`.
- Final integration stays in the main thread.
