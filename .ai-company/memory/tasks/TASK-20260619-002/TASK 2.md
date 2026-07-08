---
schema_version: 1
task_id: "TASK-20260619-002"
title: "Upgrade RepairDesk AI Company OS rules to Codex Native v3.0"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "QA"]
created_at: "2026-06-19T12:37:07Z"
updated_at: "2026-06-19T12:42:38Z"
closed_at: "2026-06-19T12:42:38Z"
---
# Task — Upgrade RepairDesk AI Company OS rules to Codex Native v3.0

## Owner request

Upgrade RepairDesk AI Company OS rules to Codex Native v3.0

## Business value

Upgrade the owner-to-AI-employee operating system from v2.0 docs to Codex Native v3.0 with project agents, skills, policies, runbooks, and formal memory.

## Scope in

- Install Codex Native v3.0 structure without overwriting RepairDesk root `AGENTS.md`.
- Update RepairDesk root and department rules to point at v3 policy and memory paths.
- Migrate v2 project memory into `.ai-company/memory/`.
- Record evidence and run proportional validation.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] Codex Native v3.0 structure is installed without overwriting RepairDesk root AGENTS.md.
- [ ] Root and department rules point to v3.0 policy and memory paths.
- [ ] v2 runtime memory is migrated to .ai-company/memory or clearly marked legacy.
- [ ] Agent rule checks and v3 structural validation pass or skipped checks are explained.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |
| v3 package includes `.codex/agents`, `.agents/skills`, `.ai-company/policies`, `.ai-company/memory`, runbooks, hooks, and `tools/ai_company.py` | observed | `/Users/kyox215/Downloads/AI_Company_OS_Codex_Native_v3.0` | accepted |
| Existing root `AGENTS.md` must not be overwritten | observed | RepairDesk root rules and v3 `INSTALLATION.md` | accepted |

## Decision and approval points

- Codex hooks are installed as files but are not claimed as trusted/executed until the target Codex environment reviews and trusts them.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
