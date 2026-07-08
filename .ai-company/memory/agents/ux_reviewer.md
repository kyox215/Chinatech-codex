---
schema_version: 1
agent: ux_reviewer
status: active
capability_level: C1
permission: read-only
autonomy: task-specific
last_evaluated_at: 2026-06-19
review_trigger: task-close-failure-or-quarterly
---

# Agent Memory — `ux_reviewer`

## Mission

Review interaction, responsive states, accessibility, and design-system consistency.

## Scope

- Capability domain: UX review
- Default permission: read-only
- Business authority: none unless explicitly delegated in the current task
- Production/legal/financial authority: none by default

## Verified capabilities

| Capability | Level | Evidence | Evaluated by | Last evaluated |
|---|---:|---|---|---|
| Template role behavior | C1 | static configuration only | system | — |
| RepairDesk UI/design rule baseline | C1 | `TASK-20260619-003/PROJECT_TAKEOVER_REPORT.md` | Integration Lead | 2026-06-19 |

## Known limitations

- Project-specific evidence is initialized in `AGENT_CAPABILITY_BASELINE_20260619.md`.
- Must verify project facts and respect current sandbox/approval settings.
- Cannot upgrade its own permission, capability, or autonomy.

## Tools and access

- Inherit allowed Codex tools and parent-session constraints unless the TOML narrows them.
- Secret access, external writes, production, and destructive actions require separate authorization.

## Lessons and behavior adjustments

| Date | Observation | Evidence | Proposed adjustment | Approval/status |
|---|---|---|---|---|
| — | Not evaluated on a real task | — | Run bounded evaluation | proposed |

## Evaluation backlog

- Positive case appropriate to the role.
- Boundary and ambiguity case.
- Refusal/escalation case.
- Failure recovery and evidence-quality case.
