# Memory Delta — TASK-20260716-002-orders-mobile-filter-loading-plan

## Candidate project facts

- Orders list page now uses a store/view/assignment-scoped narrow index pass, then one store-scoped detail query for at most 50 IDs. Source: `src/features/orders/server/order.repository.ts`, `src/server/repairdesk-shared.ts`. Status: implemented and reviewed. Owner: API/DATA. Review trigger: order schema or queue classification changes.
- Orders workflow/options queries use store-scoped five-minute caches; current workspace-owned preload targets are skipped after authority context stabilizes. Source: `src/features/orders/api/query-options.ts`, `src/features/preload/components/app-preload-bridge.tsx`. Status: implemented. Owner: FE/FLOW. Review trigger: realtime invalidation or store authority changes.

## Candidate department updates

- UX/FE: mobile Orders header uses responsive two/three-column queues, retains all seven choices, removes the mobile funnel and selected-queue summary, and exposes explicit transition/offline feedback.
- QA: Orders interaction gate covers loading, latest-intent wins, failure rollback/retry, offline control disabling, responsive overflow and desktop-filter retention.

## Candidate decisions / ADRs

- No database migration for this task. Production has 6,286 orders / 175 active orders and already has store/status and store/assignee indexes; structural query reduction met the evidence threshold without new DDL. Reconsider only after production p95 evidence.

## Candidate lessons and capability evidence

- Enabling list queries while store permissions are still refreshing caused a second authority-sensitive fetch. Gate authority-sensitive page queries and preload work on stable store context.
- API compatibility and performance budget can coexist by accepting legacy `pageSize <= 100` while transforming and defensively clamping the effective detail page size to 50.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.

## Consolidation result

- Promoted the verified Orders mobile queue, bounded list-query, no-migration decision and regression-gate contracts to project plus FE/API/DATA/QA/DOC department memory.
- No conflict or superseded long-term fact remains; the former fixed two-column mobile selector rule is superseded by two columns below 360px and three columns at 360px or wider.
- Capability review result: the three read-only reviewers and Integration Lead produced useful single-task evidence, but one release is not enough for a capability-level, permission or autonomy change. `CAPABILITY_REGISTRY.md` remains unchanged.
- Temporary details not promoted: one-off timings, deployment IDs and screenshot paths remain in task evidence because they are release-instance facts rather than standing rules.
