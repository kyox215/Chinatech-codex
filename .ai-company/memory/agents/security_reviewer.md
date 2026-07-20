---
schema_version: 1
agent: security_reviewer
status: active
capability_level: C1
permission: read-only
autonomy: task-specific
last_evaluated_at: 2026-07-13
review_trigger: task-close-failure-or-quarterly
---

# Agent Memory — `security_reviewer`

## Mission

Review threats, authn/authz, sensitive data, secrets, and supply chain.

## Scope

- Capability domain: Security review
- Default permission: read-only
- Business authority: none unless explicitly delegated in the current task
- Production/legal/financial authority: none by default

## Verified capabilities

| Capability | Level | Evidence | Evaluated by | Last evaluated |
|---|---:|---|---|---|
| Template role behavior | C1 | static configuration only | system | — |
| RepairDesk auth, role, tenant, and secret-boundary map | C1 | `TASK-20260619-003/PROJECT_TAKEOVER_REPORT.md` | Integration Lead | 2026-06-19 |
| Guided-buyback cross-layer security review | C2 candidate | `TASK-20260712-005-buyback-guided-evidence/CEO_REPORT.md` and E-010/E-014 | Integration Lead | 2026-07-13 |

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
| 2026-07-13 | Found role/runtime, proof-state, return/recheck, quality CAS and hosted-envelope gaps across iterative freezes | TASK-20260712-005-buyback-guided-evidence | Reuse a post-rebase focused security suite and keep production migration/deploy as a separate gate | C2 candidate; permission/autonomy unchanged |

## Evaluation backlog

- Positive case appropriate to the role.
- Boundary and ambiguity case.
- Refusal/escalation case.
- Failure recovery and evidence-quality case.

## 2026-07-20 evidence

- `TASK-20260720-002-platform-owner-approval`: found the platform decision-transition bypass and stale/unverified Auth identity risks, then independently verified the fixes. Retain C2 evidence; permission and autonomy remain unchanged.
