# RepairDesk Decision Flow

Status: active
Owner: Integration Lead

This file defines how RepairDesk turns one user request into department work. The user speaks to one decision owner only: the main-thread Integration Lead.

## 1. Single Entry

All non-trivial work starts with the Integration Lead.

The Integration Lead must:

- Read `AGENTS.md`.
- Read `AI智能部门管理/部门化管理设计.md`.
- Read `.agents/README.md`.
- Decide whether current web research is required.
- Decide whether the task stays single-agent or uses departments.
- Create the agenda intake before spawning agents or editing files.

Sub-agents must not ask the user for broader permission. They report blockers to the Integration Lead.

## 2. Agenda Intake

Use the agenda template before delegation:

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

## 3. Routing

Use `.agents/repairdesk-multiagent.yaml` as the machine-readable routing source.

Default routing:

- `orders`: `FLOW` primary, with `DATA`, `UX`, `FE`, `API`, `QA`, `SEC`.
- `customers`: `DATA` primary, with `SEC`, `FLOW`, `UX`, `FE`, `API`, `QA`.
- `buyback`: `FLOW` primary, with `DATA`, `API`, `UX`, `SEC`, `QA`.
- `inventory`: `DATA` primary, with `FLOW`, `API`, `QA`, `SEC`.
- `payments`: `SEC` primary, with `API`, `DATA`, `FLOW`, `UX`, `FE`, `QA`.
- `database`: `DATA` primary, with `API`, `SEC`, `QA`, `INT`.
- `mobile_ui`: `UX` primary, with `FLOW`, `FE`, `QA`, `DATA`.
- `documentation`: `DOC` primary, with `INT`, `QA`.

## 4. Batch Execution

Use bounded waves instead of unbounded parallelism:

1. Intake wave: Integration Lead classifies the task.
2. Exploration wave: 2-4 read-only departments inspect independent risks.
3. Implementation wave: 1 scoped writer by default, 2 only when paths are disjoint.
4. Verification wave: QA role simulation and command/browser checks.
5. Documentation wave: DOC updates long-term rules when the work changes standards.

Hard caps:

- Active sub-agents: 5.
- Parallel writers: 2.
- Nested sub-agents: forbidden.

Close completed agents before spawning the next wave.

## 5. Debate And Arbitration

Each department proposal must include:

```txt
department:
problem_statement:
proposal:
evidence:
affected_domains:
risks:
verification_plan:
```

Each objection must include:

```txt
raised_by:
target_proposal:
claim:
evidence:
severity: blocker | major | minor | preference
suggested_resolution:
```

The Integration Lead arbitrates conflicts using this order:

1. Latest user instruction.
2. `AGENTS.md`.
3. `AI智能部门管理/部门化管理设计.md`.
4. `docs/ARCHITECTURE.md`.
5. UI, component, responsive, and RepairOS declarations.
6. Existing code patterns.
7. Smallest safe change.
8. Individual sub-agent preference.

## 6. Completion

Work is complete only when:

- User goal is covered.
- Agent findings are accepted, rejected, or deferred with reasons.
- File ownership conflicts are resolved.
- Main thread performs final integration.
- Verification has run or skipped checks are explained.
- Final report includes changed files, departments used, validation, skipped validation, and residual risks.
