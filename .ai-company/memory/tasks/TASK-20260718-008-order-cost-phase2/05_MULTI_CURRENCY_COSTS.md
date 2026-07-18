# Stage 05 — Multi-Currency Costs

Status: pending

## Goal

Allow supplier/default/manual purchase costs in approved currencies while keeping customer quotes and store reporting in EUR.

## Scope

- Separate internal cost currency type; do not globally weaken EUR order validation.
- Store-approved cost currencies and manually managed EUR conversion rates.
- Original amount/currency, rate, rate timestamp/source and immutable EUR snapshot.
- Currency-aware inputs and formatting in authorized cost/parts surfaces.
- Profit reports aggregate only EUR base snapshots and expose original currency on drilldown.

## Validation

- EUR rate is exactly 1; non-EUR requires a positive finite rate.
- Decimal, rounding and boundary tests for every allowed currency.
- Historical costs do not change when the current rate changes.
- Missing/stale rate blocks confirmation but preserves draft input safely.
- Unauthorized roles cannot read rates or original costs.

## Exit criteria

- EUR-only Phase 1 behavior remains compatible.
- Multi-currency cost entry, allocation, report and export fixtures reconcile.
- Stage checkpoint is recorded.

