# Sub-Agent Task Package

```txt
task_id:
parent_task_id:
department:
department_id:
mode: read_only | scoped_write
status: queued | running | blocked | completed
goal:
context:
user_constraints:
must_read:
allowed_files:
forbidden_files:
owned_paths:
depends_on:
blocked_by:
expected_output:
acceptance:
verification:
deadline:
handoff_to_integration_lead: true
```

## Required Prompt Clauses

- You are not alone in the codebase.
- Do not revert changes made by others.
- Do not expand scope without Integration Lead approval.
- If mode is `read_only`, do not edit files.
- If mode is `scoped_write`, edit only allowed files.
- Return findings or changed files with exact paths.
- Report blockers to the Integration Lead instead of asking the user directly.
- A `scoped_write` package must include non-empty `allowed_files` and `owned_paths`.
