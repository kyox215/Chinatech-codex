# TASK-20260707-005 — Remove Duplicate Module Title Blocks

Status: closed
Owner: Integration Lead
Task class: T1
Risk level: R1
Autonomy level: L2
Created: 2026-07-07 CEST
Closed: 2026-07-07 CEST

## Owner Goal

Remove the repeated in-page module title block shown as `工作台 / 客户`, `客户管理`, and `全部 · 共 ...` because the application already has a top status bar / AppBar. Existing features and future generated features must not show that duplicate block.

## Scope

- Update the shared RepairOS list scaffold so default desktop rendering no longer outputs the module eyebrow/title/subtitle block.
- Preserve desktop actions and header add-ons such as save buttons, metric strips, or admin badges.
- Update UI generation and responsive documentation so future generated list/management pages do not recreate the removed block.
- Keep detail/object headers, floating mobile detail headers, card section titles, dialog titles, and accessibility titles intact.

## Out of Scope

- Production deployment.
- Database, API, permission, payment, tenant isolation, or customer communication changes.
- Removing object detail titles such as customer detail hero or mobile detail floating headers.
- Cleaning unrelated dirty worktree changes.

## Acceptance Criteria

- Shared list scaffold no longer renders `eyebrow`, `title`, or `subtitle` in the desktop page body by default.
- Desktop actions and desktop header add-ons remain visible.
- Existing RepairOS list pages stop showing the duplicate title block through the shared scaffold.
- Future-page documentation explicitly forbids page-body module title blocks in list/management pages.
- Static search confirms remaining `工作台 / ...` references are either source props now not rendered by the scaffold or documentation examples of the forbidden pattern.
- Relevant lint/type/build checks are run or any blockers are recorded.
- Visual evidence is captured if the local app can be started and a browser target can be reached.

## Agent Plan

- Primary department: FE / UX / DOC, executed by Integration Lead as single writer.
- Supporting departments considered: QA and Documentation.
- no-spawn reason: change is a small shared-component plus docs update with one write owner; spawning sub-agents would add coordination cost and risk in a dirty worktree.

## Rollback

Revert the scoped changes in:

- `src/shared/ui/repair-os-mobile.tsx`
- `docs/UI_PAGE_GENERATION_DECLARATION.md`
- `docs/REPAIROS_COMPACT_ARCHITECTURE.md`
- `docs/RESPONSIVE_DENSITY_PLAN.md`
- this task memory directory

## Closeout

- Implemented and verified.
- No production deployment, database query, schema change, customer communication, or destructive operation was performed.
- Previous shared database tenant onboarding task remains a separate parked workstream and was not advanced by this UI task.
