# Memory Delta — TASK-20260716-001-dashboard-handoff-priority

## Candidate project facts

- **Verified / project-wide:** Dashboard is now a store handoff priority workbench, not a finance/KPI homepage. Source: task code, full gates and independent reviews. Owner: Product + Integration Lead. Review trigger: Dashboard or order-priority changes.
- **Verified / API-security:** `dashboard/priority-summary` ranks the complete actor-visible active set before slicing and returns a compact allowlist; technician scope remains assigned membership. The legacy `dashboard/summary` stays temporarily for rolling compatibility. Owner: Backend + Security. Review trigger: endpoint deprecation, permission or order-list changes.

## Candidate department updates

- Product/Design/Frontend: remove Dashboard-only header chips; keep exactly two primary quick starts; show reason/current step/next step/assignee/time; navigation only.
- Backend/Security: actor scope precedes priority; caller cannot choose store/role; no phone, IMEI, unlock, supplier, signature, finance amount, unpaid aggregate or membership UUID in the DTO.
- QA: verify complete-set ranking, canonical side-state classification, role denials, filtered sample truth, five widths, long text, privacy scan, screenshots and full gates.

## Candidate decisions / ADRs

- **Accepted:** V1 sort is tier, documented reason precedence, oldest relevant timestamp, updated time, created time, public number and id.
- **Accepted:** Dashboard has no direct workflow mutation; task/detail destinations remain the permission-checked mutation boundary.
- **Accepted:** no database migration or deployment is needed for this release.

## Candidate lessons and capability evidence

- Separate a new response contract from a legacy endpoint during rolling deployments instead of changing an existing route in place.
- Counts from the complete set and items from a limited sample must never produce a false “no work” conclusion.
- One successful cross-layer task is positive C1 candidate evidence only; no capability level, permission or autonomy upgrade is authorized.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
