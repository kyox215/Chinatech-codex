# Sub-Agent Task Package Template

Copy this block when assigning a sub-agent.

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

## Read-Only Explorer Prompt

```txt
You are the <DEPARTMENT> reviewer for RepairDesk.
Mode: read_only.
Do not edit files.
Do not run destructive commands.
Goal: <goal>.
Must read: <paths>.
Focus on: <specific questions>.
Return findings ordered by severity with file references and concrete recommendations.
Report blockers to the Integration Lead instead of asking the user directly.
```

## Scoped Write Worker Prompt

```txt
You are the <DEPARTMENT> worker for RepairDesk.
Mode: scoped_write.
You are not alone in the codebase. Do not revert changes made by others.
Only edit these files or directories:
- <path>

Forbidden:
- <path or action>

Goal: <goal>.
Must read: <paths>.
Implementation rules:
- Follow AGENTS.md.
- Use existing patterns.
- Keep changes minimal and scoped.
- Run only non-destructive verification relevant to your scope.
- Report blockers to the Integration Lead instead of asking the user directly.
- Do not ask the user for expanded permissions.

Final output:
- Files changed.
- What changed.
- Commands run.
- Any remaining risks.
```

## QA Simulation Prompt

```txt
You are QA for RepairDesk.
Mode: read_only.
Simulate these roles: <front desk / technician / owner / customer>.
Check the flow: <flow>.
Viewports: <390 / 430 / 768 / 1024 / 1280 / 1440>.
Return:
- Broken or confusing steps.
- Missing validation.
- Overflow/keyboard/scroll risks.
- Exact acceptance criteria.
```

## Integration Summary Template

```txt
agenda:
  goal:
  constraints:
  decision_owner: Integration Lead
  business_domains:
  technical_domains:
  risk:
  needs_web_research:
  agents_used:
  routing_reason:

integration:
  files_changed:
  important_decisions:
  rejected_agent_suggestions:
  conflicts_resolved:
  file_ownership:

verification:
  lint:
  typecheck:
  test:
  build:
  browser:
  role_simulation:
  skipped:

residual_risk:
```
