---
schema_version: 1
task_id: "TASK-20260619-018"
title: "L2-014 stale documentation drift inventory"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "QA"]
created_at: "2026-06-19T21:13:50Z"
updated_at: "2026-06-19T21:19:36Z"
closed_at: "2026-06-19T21:19:36Z"
---
# Task — L2-014 stale documentation drift inventory

## Owner request

L2-014 stale documentation drift inventory

## Business value

Identify stale or conflicting RepairDesk documentation before future AI employees rely on it, without changing business code.

## Scope in

- Inventory markdown documentation under `docs/`, `AGENTS.md`, `AI智能部门管理/`, `.agents/`, and `.ai-company/` for likely stale or conflicting guidance.
- Compare high-risk documentation claims against current local code/config facts such as `src/app`, `src/routes`, `package.json` scripts, and active project memory.
- Separate active rules, archival/export documents, stale contradictions, assumptions, unknowns, and follow-up tasks.
- Produce a documentation impact matrix with severity, evidence, owner, recommended disposition, and safe L2 follow-ups.
- Update task memory, project/documentation memory, backlog/conflict records, and evidence.

## Scope out

- Editing business code, route implementations, UI components, API/data files, dependencies, migrations, generated output, production configuration, or customer-facing assets.
- Rewriting all documentation in this task; this is an evidence inventory and routing task, not a broad doc refactor.
- Deleting or moving archival/export docs without a separate owner-approved cleanup task.
- Staging, committing, pushing, deploying, or running production/customer-impacting operations.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Potentially stale or conflicting docs are inventoried with evidence and recommended disposition.
- [x] Verified facts, assumptions, conflicts, and unknowns are separated.
- [x] No business code, dependency, production, staging, commit, push, or deploy action is performed.
- [x] Project/documentation memory and evidence are updated.
- [x] npm run agents:check passes after memory updates.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request; `tools/ai_company.py new-task` | active |
| Current active context was idle before L2-014 | verified fact | `.ai-company/memory/ACTIVE_CONTEXT.md`; `tools/ai_company.py status` | L2-014 now active |
| `docs/` has 22 markdown documents | verified fact | `find docs -maxdepth 1 -type f ... | wc -l` | inventoried |
| Top-level non-generated markdown inventory has 201 files | verified fact | `find . -maxdepth 3 -type f -name '*.md' ... | wc -l` | broader governance/docs inventory |
| Current route source of truth is Next.js App Router | verified fact | `AGENTS.md`; `docs/UI_PAGE_GENERATION_DECLARATION.md`; `src/app/*` listing | active rule |
| Legacy `src/routes` still exists with 6 files | verified fact | `find src/routes -maxdepth 1 -type f ... | wc -l` | architecture debt, not doc-only falsehood |
| Only order list currently imports `@/routes/orders.index` | verified fact | `rg 'from \"@/routes' src` | contradicts older docs that still list dashboard as legacy-route wrapper |
| `AI智能部门管理/templates/agenda-intake.md` still points non-micro task memory to `.ai-company/runtime-memory` | verified fact | file line 39 | P1 template drift; follow-up doc fix |
| `docs/UI_CHECKLIST.md` still says route files live in `src/routes/` | verified fact | file line 22 | P1 active checklist drift; follow-up doc fix |
| `docs/ORDERS_SPEC.md` and `docs/ORDERS_FULL_EXPORT.md` are TanStack export/replication artifacts | verified fact | grep hits for TanStack Start/react-router/createFileRoute | archive/label, do not use as current RepairDesk implementation rules |

## Decision and approval points

- R1/L2: documentation/memory inventory only; no code, production, dependency, or destructive changes.
- Decision: do not edit or delete stale docs during this inventory task; create a prioritized correction map first.
- Decision: treat current root `AGENTS.md`, `docs/project-charter.md`, `docs/UI_PAGE_GENERATION_DECLARATION.md`, and active project memory as higher authority than older export/planning docs.

## Work packages

- WP-01 Context rehydrate and task intake: complete.
- WP-02 Documentation/code fact scan: complete.
- WP-03 Drift matrix and follow-up task routing: complete.
- WP-04 Memory sync: complete.
- WP-05 Validation: complete.
- WP-06 Closeout: pending.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
