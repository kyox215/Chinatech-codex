---
schema_version: 1
department: frontend
status: active
owner: Frontend Department / Integration Lead
last_verified_at: 2026-06-20
review_trigger: relevant-task-or-quarterly-review
---

# Frontend Department Memory

## Mission and boundary

Client architecture, components, forms, state, data fetching, accessibility, and browser verification.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain screens/components, App Router page thinness, React Query keys, responsive behavior, and RepairOS UI composition.
- First priority: preserve zero active `@/routes` imports, avoid reuse of classified legacy `src/routes/*`, keep order detail workflow actions inline on desktop, and continue reducing oversized order modules through scoped tasks.

## Verified rules and conventions

- Navigation currently includes overview, orders, customers, buyback, inventory, settings, and platform for platform admins.
- UI should reuse `src/components/ui/*`, `src/lib/ui-patterns.ts`, and feature query key factories.
- New navigation pages must update `AppSidebar`, `AppBar`, and command palette.
- RepairOS list/management pages must not render a page-body module title block that duplicates AppBar context, such as `工作台 / 客户`, `客户管理`, or `全部 · 共 ...`; `RepairOsListScaffold` keeps desktop actions/add-ons but no longer default-renders `eyebrow/title/subtitle` in the desktop body.
- Order detail manual status flow uses an inline desktop panel in `src/features/orders/screens/order-detail-screen.tsx`; do not reintroduce the old second desktop `状态流转` Dialog. Mobile may keep the bottom Sheet pattern for the same action list.
- `TASK-20260620-001` is the current evidence for order detail status-flow UI behavior and target E2E verification.
- `TASK-20260620-002` classified the remaining legacy `src/routes/*` files as delete-ready after Owner approval. Live page bodies remain feature screens imported by `src/app/*`; do not use `src/routes/*` as a UI source.
- `TASK-20260620-003` confirms the deletion preflight baseline is green without touching App Router or feature screen files. Future deletion must not modify `src/app/*` or `src/features/*`.
- UI duplicate ` 2` files reviewed in `TASK-20260619-005` are stale snapshots and should not be merged into canonical screens/components. If the Owner wants visual assurance before cleanup, verify current canonical order card, customer intake lookup, order task screen, and RepairOS mobile shared UI before deletion.

## Interfaces and dependencies

| Provides / consumes | Counterparty | Contract | Failure handling | Evidence | Status |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | — | unknown |

## SOPs and checklists

- Relevant Skills under `.agents/skills/` are candidate procedures.
- Project-specific commands and paths require verification before promotion.

## Risks, debt, and open questions

| ID | Risk/debt/question | Impact | Owner | Target/review | Status |
|---|---|---|---|---|---|
| FE-20260619-001 | `src/routes/orders.index.tsx` was live through order-list screen | UI refactor risk | Frontend + Architecture | resolved by TASK-20260619-025 | closed |
| FE-20260619-002 | Duplicate `* 2.*` component/screen files exist | Search/import/tooling noise | Frontend + QA | duplicate cleanup task | open |
| FE-20260619-003 | Stale UI duplicates may be mistaken for alternate approved designs | UI consistency risk | Frontend + Design | before deleting or reusing UI duplicates | open |
| FE-20260620-001 | Order detail screen remains large and contains both desktop/mobile transition surfaces | Review cost and regression risk | Frontend + QA | future order detail split task | open |

## Lessons and anti-patterns

- Do not infer project facts from the generic AI Company OS template.
- Promote repeated evidence, not stylistic preference, into durable standards.

## Capability and tool notes

| Agent/Skill | Current evidence | Capability | Permission | Limitation |
|---|---|---|---|---|
| TBD | none | C0/C1 | task-specific | not evaluated |

## Memory change log

| Date | Change | Source/task | Author/reviewer | Status |
|---|---|---|---|---|
| 2026-06-19 | Initial RepairDesk frontend baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-06-19 | Added stale UI duplicate cleanup boundary | TASK-20260619-005 | Integration Lead | active |
| 2026-06-20 | Recorded inline desktop order-detail status transition panel and target E2E proof | TASK-20260620-001 | Integration Lead | active |
| 2026-06-20 | Recorded legacy `src/routes/*` delete-ready classification and no-reuse frontend boundary | TASK-20260620-002 | Integration Lead | active |
| 2026-06-20 | Recorded legacy route deletion preflight boundary: delete only classified files after approval | TASK-20260620-003 | Integration Lead | active |
| 2026-07-07 | Recorded RepairOS list/management page rule removing duplicate page-body module title blocks | TASK-20260707-005 | Integration Lead | active |
