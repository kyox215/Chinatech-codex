# CEO Report — TASK-20260718-008 Order Cost Phase 2

Status: **conditional close / Owner Option B accepted**

## Business outcome

RepairDesk now contains the complete second-phase internal-cost foundation: append-only cost
revisions, repair operating-margin reports, supplier/parts purchase lots and allocation,
PII-minimized CSV export, preview/apply/compensate history backfill, and immutable original-currency
procurement snapshots. The production schema is present, while all five second-phase child
capabilities remain intentionally off. Phase 1 order entry continues to show “内部成本” beside
“客户报价” only to authorized management users.

## Release result

- Owner selected Stage 08 Option B, accepting the unproven physical restore/RPO/RTO and the
  pre-existing full-history migration replay failure for this release only.
- Exactly six reviewed migrations were applied to linked project `xluzcoduqsdvjoouqhkc`. Immediate
  and delayed dry-runs report the database is up to date.
- All 11 second-phase tables have RLS; browser table/RPC grants are zero; 21 RPC overloads, safe
  search paths, invoker view, constraints and indexes passed postchecks.
- Business commit `b8932b2c` was pushed non-force to `main`. Vercel deployment
  `dpl_4EenkJkcbQu9QoDnkqobRNq2Rt46` is READY for that exact SHA and serves both production domains.
- Production has the Phase 1 parent cost flag only; the five Phase 2 child flag names are absent.
- `/finance` showed the authorized-only closed state, Settings showed Phase 1 defaults without the
  procurement/currency/backfill cards, and `/orders/new` exposed the Phase 1 internal-cost and
  customer-quote fields after selecting “屏幕”. No order was submitted.
- A two-hour Vercel error-log lookback covering the deployment since creation returned no entries.
  Browser consoles were clean. Delayed
  table statistics kept procurement/allocation/stock/backfill rows at zero, with 15 cost revisions
  and 7/35/35 currency config/rate/revision rows unchanged.

## Verification summary

- 259 test files / 1,669 tests passed before release; lint, typecheck, agent checks and Webpack
  production build passed.
- Fresh PostgreSQL 17 harnesses covered ledger, profit, procurement, export, backfill and currencies.
- Current production schema restored into fresh PostgreSQL 17 and accepted all six migrations.
- Final quality conclusion is **CONDITIONAL**, because Option B accepts rather than fixes the broad
  restore and historical-replay gaps. This task is otherwise complete and the residual is owned by
  the existing Data/Operations P0 recovery work.

## Visual evidence

- Production closed Profit Center: `screenshots/production-finance-feature-off.jpg`
- Production Phase 1-only Settings: `screenshots/production-settings-phase1-only.jpg`
- Production new-order cost field: `screenshots/production-new-order-cost-field.jpg`
- Synthetic authorized Phase 2 flows remain under `screenshots/stage-02-*` through `stage-05-*`.

## Rollback and operating boundary

Do not enable a child flag or run historical backfill as part of this closeout. If dormant code
regresses, keep child flags absent/off and roll back the application; preserve additive schema and
audit history and use a reviewed forward fix. Physical restore certification, full-history replay
repair and legacy RLS/policy hardening remain separate P0 work and were not silently closed here.
