# Memory Delta — TASK-20260801-001-mobile-density-v2-release

## Candidate project facts

- Source: `ADR-20260801-001-mobile-control-density-tiers.md`; status: accepted and production verified; owner: Integration Lead; scope: mobile UI; review trigger: accessibility standard or design-system change. RepairDesk mobile controls use semantic 24/32/36/38/40–44px tiers instead of a universal 44px minimum.
- Source: Chromium/WebKit order E2E and production Chrome metrics; status: production verified; owner: Frontend; scope: `/orders`; review trigger: order header/card redesign. The order workspace satisfies the task's bounded expanded/collapsed header and card-density assertions; production 390px expanded header is 183px and search input is 38px.

## Candidate department updates

- None yet.

## Candidate decisions / ADRs

- `ADR-20260801-001-mobile-control-density-tiers.md` — accepted and production verified; preserve 16px editable text while selecting target size by action risk.

## Candidate lessons and capability evidence

- Mock E2E routes behind rollout flags must enable the current product flags; otherwise tests verify a permission fallback instead of the intended UI.
- Broad interaction scripts can contain unrelated timing failures or historical size assertions. Preserve that result explicitly and use scoped deterministic suites for task-owned claims.

Each candidate must include source, status, owner, scope, and review trigger
before long-term consolidation.
