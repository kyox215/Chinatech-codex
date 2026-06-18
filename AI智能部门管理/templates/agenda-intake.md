# Agenda Intake Template

```txt
goal:
user_constraints:
decision_owner: Integration Lead
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
- `spawn_plan` must name the batch size and departments; do not exceed the hard cap in `.agents/repairdesk-multiagent.yaml`.
- `file_ownership_plan` is required before any `scoped_write` worker is spawned.
