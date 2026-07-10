---
schema_version: 1
task_id: "TASK-20260710-072906-audit-and-fix-settings-click-touch-interac"
title: "Audit and fix settings click/touch interactions"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "Integration Lead"
departments: ["FE", "QA", "RELEASE", "UX"]
created_at: "2026-07-10T07:29:06Z"
updated_at: "2026-07-10T07:46:37Z"
closed_at: "2026-07-10T07:46:37Z"
---
# Task — Audit and fix settings click/touch interactions

## Owner request

Audit and fix settings click/touch interactions

## Business value

Restore reliable settings section navigation and verify related desktop/mobile interactions for shop workflows.

## Scope in

- Reproduce and fix settings section/touch click problems on desktop and mobile.
- Verify settings section navigation, visible hit targets, and mobile workflow card expansion with Playwright.
- Run static/build/unit checks and collect screenshot evidence.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Settings section groups can be clicked/touched on desktop and mobile, with URL, active state, and content changing consistently.
- [x] Browser simulation covers settings and related primary workflows on desktop and mobile.
- [x] Confirmed defects are fixed with scoped frontend/UI changes and no unrelated dirty files staged.
- [x] Lint, typecheck, tests, build, browser evidence, screenshots, checkpoint, commit, and push to main are completed.

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Workflow settings row controls overlapped status code at 1280px | observed | Playwright hit-target failure; desktop screenshot | fixed in `settings-screen.tsx` |
| Settings section navigation URL/active/content change | observed | `settings-section-interactions.spec.ts` | verified desktop/mobile |
| Existing order desktop E2E request source failure | observed | combined Playwright run on `business-desktop-overflow` | outside this task; separate follow-up |

## Decision and approval points

- No production data or database approval required; frontend-only UI/test change.
- No subagents spawned because the final defect was a narrow single-surface UI hit-target issue and one writer plus browser QA was lower risk.

## Closeout

- **Result:** closed after scoped frontend fix, regression test, screenshots, and validation.
- **Verification:** see `EVIDENCE.md` entries E-002 through E-010.
- **Residual risk:** unrelated `/orders` E2E request-source invalid failure remains for a separate task.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
