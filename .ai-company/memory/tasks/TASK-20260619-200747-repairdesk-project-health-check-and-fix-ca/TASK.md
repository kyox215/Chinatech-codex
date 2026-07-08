---
schema_version: 1
task_id: "TASK-20260619-200747-repairdesk-project-health-check-and-fix-ca"
title: "RepairDesk project health check and fix candidates"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Backend", "Data", "Frontend", "Integration", "QA"]
created_at: "2026-06-19T20:07:47Z"
updated_at: "2026-06-19T20:18:00Z"
closed_at: "2026-06-19T20:18:00Z"
---
# Task — RepairDesk project health check and fix candidates

## Owner request

RepairDesk project health check and fix candidates

## Business value

Establish a current health baseline for RepairDesk after rapid order, buyback, inventory, customer, attachment, and governance changes; identify errors, maintenance risks, and safe next fixes.

## Scope in

- Run governance and application quality gates.
- Inspect dirty worktree, duplicate files, legacy route usage, dependency hygiene, and common security/configuration risks.
- Apply only safe, low-risk fixes discovered during the audit.
- Produce P0/P1/P2 findings and a short execution roadmap.

## Scope out

- Deleting duplicate files or generated artifacts.
- Refactoring legacy routes or large screens.
- Changing production data, permissions, pricing, customer communications, or deployments.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] Produce evidence-based project map, P0/P1/P2 findings, safe fix candidates, and verification status

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| App is Next.js App Router with central `/api/repairdesk/[...path]` router and feature screens. | observed | `src/app/*`, `src/server/api/repairdesk-router.ts`, feature imports | verified |
| `/orders` list still wraps legacy `src/routes/orders.index.tsx`. | observed | `src/features/orders/screens/order-list-screen.tsx` | P1 architecture debt |
| Worktree contains many modified and untracked files. | observed | `git status --short` | P1 release hygiene risk |
| 76 duplicate-like `* 2.*` files remain outside ignored generated directories. | observed | `find ... -name '* 2.*'` | P1 cleanup backlog |
| Quality gates pass after safe config fix. | observed | lint/typecheck/test/build/e2e | verified |

## Decision and approval points

- No destructive cleanup performed; duplicate files need owner-approved explicit cleanup batches.
- Safe fix applied: `next.config.ts` now allows `127.0.0.1` dev origin to remove Next dev HMR cross-origin warning during Playwright runs.

## Work packages

- Integration/QA: baseline checks and health report.
- Frontend/DevEx: safe Next dev origin config fix.
- Data/Architecture: register migration/worktree/legacy-route risks for follow-up.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
