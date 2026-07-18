# Stage 05 — Multi-Currency Costs

Status: complete

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

## Implemented contract

- Supported internal procurement currencies are fixed to EUR, USD, GBP, CNY and CHF.
- EUR remains the store/reporting base at exactly 1. Customer quote schemas stay EUR-only.
- Owner manages offline conversion rates; no external rate service or network dependency was added.
- Non-EUR rates older than 30 days remain visible but block new receipts.
- Authorized allocation/cost roles can read enabled options; only Owner can read or mutate the
  complete rate configuration. Browser roles have no direct table or RPC access.
- Receipt v2 resolves the active rate in the database and stores original amount/currency, rate,
  timestamp/source, rate revision and rounded EUR unit-cost snapshot. The compatibility receipt
  RPC is restricted to EUR=1 and cannot inject non-EUR rates.
- Current rate edits append revision evidence and never update existing lots, allocations or
  order cost projections.
- Profit totals remain EUR. Authorized report drilldown and PII-minimized CSV export expose the
  original-currency snapshot for reconciliation.

## Verification completed

- Fresh disposable PostgreSQL replay through Stages 01–05 passed on
  `repairdesk_cost_currency_20260718_c`, ending in
  `order_cost_phase2_multi_currency_harness_passed`.
- The harness covered fixed currencies, EUR=1, decimal bounds, current/stale/disabled rates,
  client-rate injection denial, EUR/USD/CNY receipts, idempotent replay, immutable historical
  snapshots after a rate change, order allocation, report drilldown, export reconciliation,
  ACLs, append-only revisions and new-store initialization.
- `npm run lint`, `npm run typecheck`, `git diff --check`, 86 focused tests and the complete
  259-file / 1669-test suite passed.
- `npx next build --webpack` passed and generated 25 application pages. The default Turbopack
  command was separately blocked only by the isolated worktree's out-of-root `node_modules`
  symlink.
- Browser verification saved Owner settings and rendered a USD receipt preview at 0.88 EUR,
  with all requests returning HTTP 200 and no console errors.
- Screenshots: `screenshots/stage-05-cost-currency-settings-1440.png` and
  `screenshots/stage-05-usd-procurement-preview-1440.png`.

## Rollback

- Leave `REPAIRDESK_COST_MULTI_CURRENCY_ENABLED` unset or `0` to preserve the existing EUR-only
  UI and compatibility receipt path.
- The migration is additive. Do not delete rate or snapshot rows during rollback; disable the
  child feature and deploy the prior application version.
