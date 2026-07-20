---
schema_version: 1
agent: qa_reviewer
status: active
capability_level: C2
permission: read-only
autonomy: task-specific
last_evaluated_at: 2026-06-19
review_trigger: task-close-failure-or-quarterly
---

# Agent Memory — `qa_reviewer`

## Mission

Verify acceptance criteria, tests, edge cases, regressions, and evidence.

## Scope

- Capability domain: Quality review
- Default permission: read-only
- Business authority: none unless explicitly delegated in the current task
- Production/legal/financial authority: none by default

## Verified capabilities

| Capability | Level | Evidence | Evaluated by | Last evaluated |
|---|---:|---|---|---|
| Template role behavior | C1 | static configuration only | system | — |
| RepairDesk local gate execution and interpretation | C2 | `TASK-20260619-003/EVIDENCE.md` E-016 through E-021 | Integration Lead | 2026-06-19 |

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

## 2026-07-20 evidence

- `TASK-20260720-002-platform-owner-approval`: caught R4/L1 task-evidence drift, verified the authority negative matrix and required exact-SHA reruns after remote-main movement. Retain C2 evidence; permission and autonomy remain unchanged.
