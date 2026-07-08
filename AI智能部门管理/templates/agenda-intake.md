# Agenda Intake Template

```txt
task_id:
goal:
business_value:
user_constraints:
decision_owner: Integration Lead
autonomy_level: L0 | L1 | L2 | L3 | L4
needs_web_research: yes | no
research_sources:
business_domains:
technical_domains:
risk: low | medium | high
requires_multi_agent: yes | no
routing_reason:
primary_department:
supporting_departments:
spawn_plan:
file_ownership_plan:
task_memory:
evidence_index:
checkpoint_plan:
read_first:
allowed_change_scope:
acceptance:
verification:
stop_condition:
```

## Decision Notes

- If the user explicitly asks for multi-agent/sub-agent/department work, set `requires_multi_agent: yes`.
- If current external knowledge may change the decision, set `needs_web_research: yes`.
- If customer PII, payment, auth, inventory movement, database schema, or workflow transitions are touched, risk is at least `medium`.
- If the next action is tightly coupled and blocking, keep it local even when the overall task uses agents.
- The user-facing decision owner is always `Integration Lead`.
- Default autonomy is L2 unless the owner explicitly sets a different level.
- Use `.ai-company/memory/tasks/<task_id>/` for non-micro task memory when the task changes rules, architecture, data, UI patterns, security posture, or long-running context. `.ai-company/runtime-memory/` is legacy trace-only memory.
- `spawn_plan` must name the batch size and departments; do not exceed the hard cap in `.agents/repairdesk-multiagent.yaml`.
- `file_ownership_plan` is required before any `scoped_write` worker is spawned.
