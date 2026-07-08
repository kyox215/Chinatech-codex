---
schema_version: 1
task_id: "TASK-20260619-020"
title: "L2-016 archive snapshot banners for historical planning docs"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "QA"]
created_at: "2026-06-19T21:24:33Z"
updated_at: "2026-06-19T21:27:21Z"
closed_at: "2026-06-19T21:27:21Z"
---
# Task — L2-016 archive snapshot banners for historical planning docs

## Owner request

L2-016 archive snapshot banners for historical planning docs

## Business value

Prevent future AI employees from treating historical TanStack/export/planning documents as current RepairDesk implementation authority.

## Scope in

- Add archive/snapshot banners to the six L2-014 historical/export/planning candidate documents:
  - `docs/ORDERS_SPEC.md`
  - `docs/ORDERS_FULL_EXPORT.md`
  - `docs/REFACTOR_EXECUTION_PLAN.md`
  - `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md`
  - `docs/GPT_PROJECT_REPLANNING_BRIEF.md`
  - `docs/PROJECT_REPLAN_FROM_MOBILE_MVP_V1_5.md`
- Preserve original historical content and avoid moving/deleting files.
- State that current `AGENTS.md`, App Router, v3 memory, and RepairOS rules override each historical document.
- Update task evidence, project/documentation memory, backlog, and handoff.

## Scope out

- Editing business code, route implementations, UI components, API/data files, dependencies, migrations, generated output, production configuration, staging, commits, pushes, or deploys.
- Rewriting the full content of the historical documents.
- Moving documents into `docs/archive/` or deleting them.
- Adding the global owner/freshness metadata convention to all docs.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Archive or snapshot banners are added to the six L2-014 archive/snapshot candidate docs without deleting content.
- [x] Each banner states that current App Router, v3 memory, and RepairOS rules override the historical document.
- [x] No business code, dependency, production, staging, commit, push, or deploy action is performed.
- [x] Task memory, project/documentation memory, backlog records, and evidence are updated.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| L2-016 task exists and is active | verified fact | `TASK.md`; `.ai-company/memory/ACTIVE_CONTEXT.md` | active until closeout |
| L2-014 identified six historical/export/planning docs as archive/snapshot candidates | verified fact | `TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | fixed in this task |
| Current active context was idle before task creation | verified fact | `tools/ai_company.py status` | safe to create L2-016 |
| Broader worktree is dirty | observed boundary | `git status --short` | preserve unrelated changes |
| Candidate docs had no current diff before banner insertion | verified fact | `git diff -- <six docs>` before edit | safe local edit scope |

## Decision and approval points

- R1/L2: documentation banners only, reversible, no business-code or production effect.
- Decision: banner-label in place instead of moving/deleting documents to preserve historical context.
- Decision: do not include active docs such as `docs/DESIGN_SYSTEM.md` or `docs/COMPONENT_GENERATION_DECLARATION.md` in this archive batch; their future fixes are separate targeted tasks.

## Work packages

- Intake and risk classification: complete.
- Pre-edit candidate verification: complete.
- Archive/snapshot banner insertion: complete.
- Validation: complete.
- Memory sync: complete.
- Closeout: pending.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
