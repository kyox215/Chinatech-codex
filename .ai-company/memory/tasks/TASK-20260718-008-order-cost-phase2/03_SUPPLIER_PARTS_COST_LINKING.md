# Stage 03 — Supplier and Parts Cost Linking

Status: completed

## Goal

Link repair-order lines to real spare-part purchase lots so confirmed historical costs remain traceable.

## Scope

- Store-private spare-part catalog and compatibility metadata.
- Supplier purchase lots with received/available quantity and original/base unit cost.
- Order-line allocations, quantity consumption, release/return and immutable cost snapshots.
- Suggested matching by catalog/model; authorized confirmation before allocation.
- Actual lot cost first; weighted-average fallback only when no traceable lot exists.
- Settings/Profit Center management UI and order-cost source selector.

## Delivered

- Store-private `parts_catalog_items`, `parts_purchase_lots`, `order_part_allocations` and
  append-only `part_stock_movements`, with same-store foreign keys and service-role-only RPCs.
- Idempotent catalog creation and receiving; allocation locks the order line and purchase lot,
  rejects over-consumption, decrements stock and writes a `purchase_lot` cost snapshot.
- Release locks the allocation and lot, writes a compensating movement and restores the prior
  cost projection only when that projection still belongs to the released lot.
- Supplier and category dimensions are joined into the bounded Profit Center report without
  exposing customer PII or moving aggregation into the browser.
- Settings UI for spare-part catalog and EUR lot receiving; desktop and mobile order UI for
  authorized lot allocation/release; dedicated permission hides both UI and network requests.
- Weighted average is displayed as a selection aid only. This phase does not create an
  untraceable fallback allocation when no purchase lot exists.

## Validation

- Same-store foreign keys, unique/idempotency constraints and indexed lookup paths.
- Concurrent allocation cannot over-consume a lot.
- Cancel/remove/return produces a compensating movement without deleting history.
- Later purchase-price edits do not rewrite completed-order cost snapshots.
- Supplier and cost fields remain absent for unauthorized roles.
- Targeted unit, repository, migration and UI tests.

## Verification result

- Exact disposable PostgreSQL chain (Stages 01–03 plus focused schema fixtures) passed with
  `order_cost_phase2_parts_harness_passed`.
- The fixture verified receive, idempotent replay, allocation, stock reconciliation,
  over-consumption denial, immutable economic snapshots, supplier profit breakdown, release,
  prior-cost restoration, reallocation, technician denial and browser-table ACL denial.
- Full lint and TypeScript checks passed. Focused Stage 03 regression passed 10 files / 130
  tests; targeted store-capability checks for repair-cost and part-allocation permissions passed.
- `npx next build --webpack` passed and generated all 25 application pages.
- Browser verification passed for settings, order and Profit Center. Desktop and 390px mobile
  order flows executed allocate → release → reallocate against synthetic data, with no fresh
  console errors and no horizontal overflow.
- A broader existing store-repository test file was also attempted; three unrelated invite-link
  cases use expired fixed timestamps at the 2026-07-18 clock. Stage 03 permission cases passed;
  the time-dependent baseline tests are deferred to Stage 06 quality cleanup.
- Screenshot evidence:
  - `screenshots/stage-03-parts-settings-1440.png`
  - `screenshots/stage-03-order-part-allocation-1440.png`
  - `screenshots/stage-03-order-part-allocation-390.png`
  - `screenshots/stage-03-profit-breakdowns-1440.png`

## Exit criteria

- A complete receive → allocate → release/consume → report path is verified.
- Inventory quantity and order cost reconcile in fixtures.
- Stage checkpoint and evidence are recorded.

Exit criteria satisfied on 2026-07-18. Stage 04A may begin.
