---
schema_version: 1
department: design
status: active
owner: Design Department / Integration Lead
last_verified_at: 2026-06-19
review_trigger: relevant-task-or-quarterly-review
---

# Design / UX Department Memory

## Mission and boundary

Design system, interaction states, accessibility, responsive behavior, and usability evidence.

This department advises and maintains its own standards. It does not obtain
legal, financial, production, or organization authority merely by being named
as owner of this file.

## Current objectives and work in progress

- Maintain RepairOS visual language, density rules, mobile detail/task standards, and token discipline.
- First priority: keep new UI changes tied to existing `docs/REPAIROS_*` and token sources.

## Verified rules and conventions

- `src/styles.css` is the color source.
- Mobile detail/task/workflow pages must follow RepairOS Floating Card language from the project docs and current mobile order detail source of truth.
- RepairOS list/management pages should open directly into KPI, filters, chips, toolbars, or business content; do not add duplicate page-body module title blocks when AppBar already provides module context.
- Visual claims require screenshot/browser evidence when UI changes are made.

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
| DES-20260619-001 | Stale duplicate docs may conflict with current UI standards | Inconsistent future UI | Design + Documentation | before UI generation work | open |

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
| 2026-06-19 | Initial RepairDesk design baseline synchronized | TASK-20260619-003 | Integration Lead | active |
| 2026-07-07 | Added no-duplicate-module-title rule for RepairOS list/management pages | TASK-20260707-005 | Integration Lead | active |
