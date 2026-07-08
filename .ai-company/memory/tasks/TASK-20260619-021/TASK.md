---
schema_version: 1
task_id: "TASK-20260619-021"
title: "L2-017 active documentation metadata convention"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead / CEO Agent"
departments: ["DOC", "INT", "QA"]
created_at: "2026-06-19T21:28:10Z"
updated_at: "2026-06-19T21:31:58Z"
closed_at: "2026-06-19T21:31:58Z"
---
# Task — L2-017 active documentation metadata convention

## Owner request

L2-017 active documentation metadata convention

## Business value

Make active RepairDesk authority docs easier for future AI employees to distinguish from historical snapshots.

## Scope in

- Add lightweight active-document metadata to seven core RepairDesk authority docs:
  - `docs/ARCHITECTURE.md`
  - `docs/UI_PAGE_GENERATION_DECLARATION.md`
  - `docs/COMPONENT_GENERATION_DECLARATION.md`
  - `docs/REPAIROS_COMPACT_ARCHITECTURE.md`
  - `docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`
  - `docs/RESPONSIVE_DENSITY_PLAN.md`
  - `docs/UI_CHECKLIST.md`
- Metadata must expose status, owner, scope, and last-reviewed task.
- Preserve existing content and historical snapshot banners.
- Update task evidence, project/documentation memory, backlog, and handoff.

## Scope out

- Business code, route implementations, UI components, API/data files, dependencies, migrations, generated output, production configuration, staging, commits, pushes, deploys.
- Adding metadata to every markdown file in the repository.
- Changing historical/export document contents beyond already-added L2-016 banners.
- Rewriting active documentation rules.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Core active architecture/UI/responsive docs expose status, owner, scope, and last-reviewed metadata.
- [x] Existing historical snapshot banners remain intact.
- [x] No business code, dependency, production, staging, commit, push, or deploy action is performed.
- [x] Task memory, project/documentation memory, backlog records, and evidence are updated.
- [x] npm run agents:check passes.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| L2-017 task exists and is active | verified fact | `TASK.md`; `.ai-company/memory/ACTIVE_CONTEXT.md` | active until closeout |
| L2-014 identified broad docs metadata gaps | verified fact | `TASK-20260619-018/STALE_DOCUMENTATION_DRIFT_INVENTORY.md` | this task addresses core active docs only |
| L2-016 archive/snapshot banners remain intact | verified fact | six historical docs contain `TASK-20260619-020` banners | outside rewrite scope |
| Core active docs lacked consistent owner/status/last-reviewed metadata | observed | pre-edit file headers | fixed in this task |
| Broader worktree is dirty | observed boundary | `tools/ai_company.py status`; `git status --short` | preserve unrelated changes |

## Decision and approval points

- R1/L2: documentation metadata only, reversible, no business-code or production effect.
- Decision: apply metadata only to the core active authority docs first; do not mass-edit all markdown files.

## Work packages

- Intake and risk classification: complete.
- Core active-doc metadata insertion: complete.
- Validation: complete.
- Memory sync: complete.
- Closeout: pending.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
