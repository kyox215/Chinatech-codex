---
schema_version: 1
task_id: "TASK-20260720-002-platform-owner-approval"
title: "Restrict platform approval to project owner and deploy"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "Hexiang Huang"
departments: ["Data", "QA", "Release", "Security"]
created_at: "2026-07-20T21:31:13Z"
updated_at: "2026-07-20T21:50:55Z"
---
# Task — Restrict platform approval to project owner and deploy

## Owner request

Restrict platform approval to project owner and deploy

## Business value

Ensure only the verified project owner can exercise platform approval authority.

## Scope in

- Canonical platform-owner identity configuration for `kyox120@gmail.com`.
- Fail-closed application authorization for platform administration and approvals.
- Bootstrap guards preventing elevation of any other email.
- Database constraints and triggers enforcing the same authority boundary.
- Isolated production release, verification, and rollback evidence.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] Only verified kyox120@gmail.com can pass platform administrator authorization.
- [ ] Application and database controls fail closed for all other identities.
- [ ] Release passes tests, dry-run, production checks, and has a documented rollback path.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Canonical owner email | observed | owner request and project instructions | fixed to `kyox120@gmail.com` |
| Root worktree contains unrelated work | observed | `git status` | release from isolated `origin/main` worktree |
| Linked migration state | observed | migration list and dry-run | only `20260720231500` pending |

## Decision and approval points

- Owner approved deployment on 2026-07-20.
- Production database apply remains gated on app-first verification and fresh linked-project preflight.
- A future AAL2/recent-MFA requirement is out of scope and remains a documented hardening item.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
