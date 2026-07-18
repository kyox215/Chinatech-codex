# Stage 03 — Supplier and Parts Cost Linking

Status: pending

## Goal

Link repair-order lines to real spare-part purchase lots so confirmed historical costs remain traceable.

## Scope

- Store-private spare-part catalog and compatibility metadata.
- Supplier purchase lots with received/available quantity and original/base unit cost.
- Order-line allocations, quantity consumption, release/return and immutable cost snapshots.
- Suggested matching by catalog/model; authorized confirmation before allocation.
- Actual lot cost first; weighted-average fallback only when no traceable lot exists.
- Settings/Profit Center management UI and order-cost source selector.

## Validation

- Same-store foreign keys, unique/idempotency constraints and indexed lookup paths.
- Concurrent allocation cannot over-consume a lot.
- Cancel/remove/return produces a compensating movement without deleting history.
- Later purchase-price edits do not rewrite completed-order cost snapshots.
- Supplier and cost fields remain absent for unauthorized roles.
- Targeted unit, repository, migration and UI tests.

## Exit criteria

- A complete receive → allocate → release/consume → report path is verified.
- Inventory quantity and order cost reconcile in fixtures.
- Stage checkpoint and evidence are recorded.

