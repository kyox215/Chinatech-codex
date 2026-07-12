# Memory Delta — TASK-20260712-002-global-staff-permissions

## Candidate project facts

- Source: `src/server/permissions.ts`, order/customer/inventory repositories. Status: implemented and fully tested. Owner: RepairDesk. Scope: all stores. Review trigger: role or export policy change. Fact: list/aggregate finance is separate from single-order finance; technician and front desk can see an authorized order amount without receiving aggregate/profit/export access.
- Source: `20260712003452_global_order_assignment_scope.sql`. Status: pending production apply. Owner: database/release. Scope: all stores. Review trigger: migration apply. Fact: stable technician authorization uses same-store membership ID; legacy rows first match one active display name and otherwise fall back to the unique active store owner.
- Source: `order.repository.ts` and independent security review. Status: verified. Owner: backend/security. Scope: all stores. Review trigger: assignment model change. Fact: pre-migration technician order access is fail-closed because mutable legacy names are not authorization keys; after migration only same-store membership IDs authorize object access.

## Candidate department updates

- Backend: central permission actions now separate single-order finance, aggregate finance, profit, archive browsing/search and bulk output; order object scope is enforced in repositories before child reads or writes.
- Security: kiosk session review is owner/manager-only; HTTP 401/403 is authority loss and clears tenant-sensitive browser caches before paint; the separate 17-table public/RLS production risk remains open.
- QA: final snapshot passed agents/lint/typecheck, 119 files / 800 tests, 22-route production build, linked migration dry-run and desktop/mobile visual checks.

## Candidate decisions / ADRs

- Source: owner request plus `TASK.md`. Status: accepted. Owner: 鹤祥. Scope: global. Review trigger: product policy change. Decision: completed-and-paid and cancelled orders are hidden from the default queue, while paid-active and completed-unpaid remain visible.
- Source: store permission migration and repository. Status: implemented. Owner: security/API. Scope: member grants. Review trigger: new grant action. Decision: role/status change revokes grants transactionally, and grant-set edits use one serialized complete-set replacement RPC.

## Candidate lessons and capability evidence

- Browser evidence found and fixed a 1440px toolbar clipping defect before release; desktop/mobile screenshots and DOM overflow metrics are stored under `evidence/`.
- Capability review: one high-risk authorization task completed after independent security review found and verified fixes for three attack paths. This is useful C1/C2 evidence only; no permission or autonomy upgrade is approved from a single task.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
