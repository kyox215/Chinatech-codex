---
schema_version: 1
task_id: "TASK-20260619-232915-l2-029-enforce-real-sub-agent-spawning-for"
title: "L2-029 enforce real sub-agent spawning for owner-requested department work"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "QA"]
created_at: "2026-06-19T23:29:15Z"
updated_at: "2026-06-19T23:39:26Z"
closed_at: "2026-06-19T23:39:26Z"
---
# Task — L2-029 enforce real sub-agent spawning for owner-requested department work

## Owner request

L2-029 enforce real sub-agent spawning for owner-requested department work

## Business value

Ensure the Owner AI-employee operating model uses actual Codex sub-agents when the Owner requests departments or AI employees, instead of only labeling departments in documents.

## Scope in

- Strengthen root and department rules so Owner-requested AI employee / department work requires real sub-agent spawning when tools are available.
- Define the no-spawn exception path and reporting requirement.
- Update multi-agent checklist and routing config to record agent ids/roles or no-spawn reason.
- Use real DOC and QA sub-agents for this repair and record their evidence.

## Scope out

- Business code, app behavior, database migrations, dependencies, production data, deployment, staging, commit, push, or destructive actions.
- Forcing sub-agent spawning for tiny single-action tasks where the Owner did not request departments and the startup cost exceeds value.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Rules state that when the Owner explicitly requests sub-agents, departments, AI employees, multi-agent execution, review, or simulation, the Integration Lead must use actual spawn_agent sub-agents when the tool is available.
- [x] Rules define the exception path: if sub-agent tooling is unavailable, unsafe, or disproportionate, the final report must state why no real sub-agent was spawned and whether the department work was simulated or deferred.
- [x] Multi-agent checklist requires recording spawned agent roles/ids or a no-spawn reason.
- [x] The fix itself uses real sub-agents for DOC and QA review, with their conclusions recorded in task evidence.
- [x] No business code is modified.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner asked whether the sub-agent execution issue is fixed | verified fact | owner message | fix rules, not just explain |
| Sub-agent tool is available in this session | verified fact | `multi_agent_v1.spawn_agent` returned DOC and QA agent ids | use real sub-agents for this task |
| Existing rules already mention multi-agent triggers but allowed main-thread over-compression in practice | verified fact | `AGENTS.md`; `AI智能部门管理/部门化管理设计.md`; `.agents/repairdesk-multiagent.yaml` | make real spawn and no-spawn reporting explicit |
| This is governance/process work only | verified fact | scope and acceptance | no business code changes |

## Decision and approval points

- R1/L2: reversible governance/documentation update. No production, data, permission, dependency, or business-code change.
- Future exception path: if tools are unavailable or unsafe, record no-spawn reason and do not pretend departments were spawned.

## Work packages

- Intake and classification: completed.
- Real sub-agent spawning: DOC `019ee237-b920-7111-af6e-e9f978be5c48` / Ledger and QA `019ee237-d2cc-7791-980a-f50c26063fa5` / Probe spawned as read-only reviewers.
- Rule updates: completed.
- Sub-agent result merge: completed in `SUBAGENT_REVIEW_REPORT.md`.
- Memory sync: completed in project, DOC, and QA memory.
- Validation: completed with targeted rule scan, `npm run agents:config`, `npm run agents:templates`, and `npm run agents:check`.
- Closeout: completed; task closed at 2026-06-19T23:39:26Z.

## Spawn Plan and Results

| Department | Codex agent | Mode | Agent ID | Spawn status | Result status | Notes |
|---|---|---|---|---|---|---|
| DOC | `documentation_reviewer` | read_only | `019ee237-b920-7111-af6e-e9f978be5c48` | spawned | completed | Identified missing real-spawn binding and recommended authority surfaces. |
| QA | `qa_reviewer` | read_only | `019ee237-d2cc-7791-980a-f50c26063fa5` | spawned | completed | Blocked closeout until conclusions, attribution, and targeted scans were recorded. |

## No-Screenshot Reason

No related app/UI task page exists because this task only changes governance markdown and memory. Alternate evidence is the updated rule files, sub-agent ids/results, targeted scans, and governance checks.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
