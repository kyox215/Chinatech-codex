# Stage 07 — Production Release and Observation

Status: production release and dormant-state observation passed — 2026-07-18T15:53:47Z

## Goal

Apply only reviewed TASK-008 migrations, fast-forward `main`, deploy the exact commit and verify production behavior.

## Sequence

1. Acquire the serialized release lock and re-fetch `origin/main`.
2. Rebase/reconstruct on current remote if required; rerun affected gates.
3. Verify linked migration history and production data volume/metadata.
4. Run an exact `supabase db push --linked --dry-run`; stop on any unrelated migration.
5. Verify backup/recovery and rollback evidence required by the Database Application Gate.
6. Apply only TASK-008 additive migrations and immediately verify history, tables, constraints, indexes, RLS, ACL and RPC execution grants.
7. Push the reviewed commit fast-forward to `main`.
8. Confirm Vercel READY for the same SHA; keep high-risk capabilities feature-gated until schema checks pass.
9. Run Owner/authorized-Manager/unauthorized production smoke without exposing PII.
10. Inspect runtime errors and business invariants during the observation window.

## Rollback

- Disable individual Phase 2 feature flags first.
- Revert or roll back the application deployment when code behavior is unsafe.
- Preserve additive schema/audit records and use forward fixes; do not drop cost history in an emergency.
- Do not execute historical backfill automatically as part of deployment.

## Exit criteria

- Remote `main`, production deployment and reported SHA match.
- Linked migration history and metadata checks pass.
- Production smoke, screenshots and runtime error scan pass.
- Observation result and rollback reference are recorded before closeout.

## Read-only production preflight result

The serialized release owner for this preflight was the main Integration Lead. All prior Stage 00
review agents were completed, the isolated worktree was clean, and a final `git fetch --prune`
showed candidate `8e5046723045079e1317acdeb1385cedbd19a128` seven commits ahead and zero
behind `origin/main@51d5b3b9648e77b355bb5635edf8df4c431eeb74`.

### Passed gates

- Supabase CLI 2.101.0 successfully linked the isolated candidate to project
  `xluzcoduqsdvjoouqhkc` without exposing credentials.
- `supabase migration list --linked` showed Phase 1 migrations `20260718120000` and
  `20260718121000` already applied and exactly six TASK-008 migrations pending.
- `supabase db push --linked --dry-run` completed without mutation and selected only:
  - `20260718122000_order_cost_phase2_ledger_permissions.sql`
  - `20260718123000_order_cost_phase2_profit_reports.sql`
  - `20260718124000_order_cost_phase2_parts_procurement.sql`
  - `20260718130000_order_cost_phase2_cost_export.sql`
  - `20260718133000_order_cost_phase2_history_backfill.sql`
  - `20260718140000_order_cost_phase2_multi_currency.sql`
- The latest visible physical backup is `2026-07-18T06:49:11.673Z`, status `COMPLETED`; eight
  consecutive completed physical backups are visible.
- A live catalog query found browser grants and RLS-disabled legacy tables no longer overlap:
  17 public tables have RLS disabled, 15 different public tables have anon/authenticated grants,
  and the intersection count is zero. This narrows but does not close the older security debt.
- A fresh schema-only dump of the current production database contained no data statements and
  restored completely into a new PostgreSQL 17 database. The six Phase 2 migrations then applied
  in exact order with `ON_ERROR_STOP=1`.
- The restored-current-schema assertions passed: 11/11 tables present with RLS, zero browser table
  grants, 11/11 service-role SELECT coverage, zero browser execution grants across 21 Phase 2 RPC
  overloads, safe empty function search paths, `security_invoker=true` on the profit view, and zero
  unvalidated Phase 2 constraints.
- Live count-only inspection showed 6,326 repair orders but only 15 existing Phase 1 cost rows and
  zero default-cost rows. Historical backfill remains an explicit Owner action and was not run.

### Failed hard gates

1. **Recovery gate — FAIL.** `supabase backups list` reports `pitr_enabled=false`; there is no
   isolated restore drill, verified restore artifact, RPO/RTO or restore-owner proof. A visible
   completed backup is not proof that recovery works.
2. **Historical recovery baseline — OWNER EXCEPTION OR REMEDIATION REQUIRED.** The same-day clean replay still stops before TASK-008 at
   `20260611102805_repairdesk_remote_schema_compatibility.sql` because
   `inventory_items.product_channel` is absent. Current production schema recovery plus all six
   Phase 2 migrations now passes, so this is not a Phase 2 compatibility failure; it remains an
   unresolved broad recovery-baseline risk under the project Database Application Gate.
3. **Legacy defense-in-depth gate — OPEN, NOT A CURRENT BROWSER BYPASS.** The live database still
   has 17 public legacy tables with RLS disabled, but none has anon/authenticated grants. The
   permissive policies on `orders`, `repair_quotes`, and `suppliers` also have no current browser
   grants. Five legacy functions have mutable search paths, and `recycling_models` showed recent
   database activity. Consumer discovery is required before legacy hardening; the older direct
   browser-exposure wording is superseded by the fresh catalog evidence.
4. **Observation gate — NOT STARTED.** Because migration apply, Git push and deployment were
   correctly stopped, no exact-SHA production smoke or observation window can be claimed.

## Stop decision

Result: **NO-GO pending explicit recovery decision / conditional delivery.** No linked migration was applied, no production data was
changed, no Phase 2 feature flag was enabled, `main` was not pushed and Vercel was not deployed.
This is the required outcome of a failing R4 production gate, not a partial hidden release.

Stage 08 now records the Owner's Option B selection: a written exception accepting the untested
physical-restore and full-history replay risks for this release only. This removes only that
approval stop; every remote-state, exact-migration, metadata, Git and deployment assertion remains
mandatory and must be refreshed before its corresponding write.

A complete P0 recovery/security package should still:

1. reconstructs or repairs the full historical migration recovery baseline;
2. records a current backup/PITR strategy and completes an isolated restore drill with artifact,
   hashes, RPO/RTO and restore owner;
3. discovers consumers and safely handles the 17 RLS-disabled legacy tables plus the seven
   over-permissive write policies and mutable-path functions;
4. repeats fresh fetch, migration list, exact dry-run, advisors and pre/post release assertions.

After the fresh preflight passes, this stage may continue from migration apply step 6. The six
migration files and all application flags must remain unchanged and off in the meantime.

## Option B fresh write-preflight

At `2026-07-18T15:32:27Z`, under the atomic release lock:

- `origin/main` remained `51d5b3b9648e77b355bb5635edf8df4c431eeb74`; candidate
  `a7a95d18e4b8abe06ce16cc7be7bd88c4606ae9c` was zero behind and ten ahead.
- Linked migration history still showed Phase 1 through `20260718121000` applied and exactly the
  six reviewed Phase 2 versions pending.
- `supabase db push --linked --dry-run` selected only those six files and did not mutate data.
- Eight completed physical backups remained visible; latest backup ID `1145221500` was completed
  at `2026-07-18T06:49:11.673Z`. PITR remained disabled, as accepted by Option B.
- Security advisors were unchanged: five pre-existing mutable-search-path functions, seven
  pre-existing permissive policies and leaked-password protection disabled. No Phase 2 object was
  reported.
- Count-only linked SQL returned PostgreSQL `17.6`, 6,326 repair orders, 15 Phase 1 cost lines,
  zero defaults, zero Phase 2 tables, zero browser grants on Phase 2 names, and zero browser grants
  on the three advisor policy tables.

Result: **GO for the exact six-file linked apply only.** Any subsequent drift reverts this result
to NO-GO.

## Production database apply and postcheck

Under the same release lock, `supabase db push --linked --yes` applied exactly the six migrations
listed above without `--include-all`, seed, roles or backfill execution. The command returned
success for each version.

Immediate postchecks proved:

- linked history contains all six local/remote versions and a new exact dry-run reports the remote
  database is up to date;
- all 11 Phase 2 tables exist, all 11 have RLS, all 11 allow service-role SELECT, and browser table
  privileges remain zero;
- all 21 expected RPC overloads exist, browser EXECUTE privileges remain zero, and no expected
  security-definer function lacks `search_path=''`;
- the profit fact view has `security_invoker=true`; no Phase 2 constraint is unvalidated and no
  Phase 2 index is invalid or unready;
- the 15 existing Phase 1 cost rows produced exactly 15 append-only migration revisions; zero cost
  defaults produced zero default versions;
- seven stores produced seven currency configs, 35 fixed currency rows and 35 migration revision
  snapshots;
- parts catalog, lots, allocations, stock movements, backfill runs and backfill candidates all
  remain empty, proving deployment did not create procurement activity or execute a historical
  backfill;
- post-apply security advisors match the pre-apply legacy warning set and contain no Phase 2
  finding.

Result: **database release slice PASS.** Next authorized write is a non-force fast-forward push of
the exact reviewed candidate to remote `main`, after another fresh fetch/divergence assertion.

## Git and application release

After a fresh fetch, candidate and `origin/main` were confirmed fast-forward compatible. The
Integration Lead used a non-force `git push --porcelain origin HEAD:main`; remote `main`, branch
HEAD and the reviewed business release all resolved to
`b8932b2c7b5d5752c0cb5dfc6597a68decbe2262` with zero divergence.

Git integration created Vercel deployment `dpl_4EenkJkcbQu9QoDnkqobRNq2Rt46`. Production metadata
reported `READY`, target `production`, the exact Git SHA above, and aliases `chinatech.in`,
`www.chinatech.in`, the production project alias and the main-branch alias.

The production environment contains `REPAIRDESK_ORDER_COSTS_ENABLED`; none of the five Phase 2
child flag names exists. No flag value was read or recorded. Dormant rollout is therefore
fail-closed at both code and configuration boundaries.

## Production smoke and visual evidence

Using the existing authenticated Owner test workspace without opening customer/order records or
submitting any form:

- `/finance` rendered “此页面仅对获授权人员开放” and no profit metrics, export or drilldown;
- `/settings?section=rules` retained the Phase 1 default-cost editor but exact text counts for
  procurement, currency and history-backfill cards were all zero;
- `/orders/new`, after locally selecting “屏幕”, showed “内部成本” beside “客户报价”; no customer
  data was entered and the order remained unsubmitted;
- browser warning/error logs were empty for all three routes.

PII-free evidence is stored at:

- `screenshots/production-finance-feature-off.jpg`
- `screenshots/production-settings-phase1-only.jpg`
- `screenshots/production-new-order-cost-field.jpg`

## Observation

- A two-hour Vercel error-level lookback covering the deployment since creation returned no entries.
- A delayed linked migration dry-run reported `Remote database is up to date`.
- Delayed linked table statistics kept parts catalog, purchase lots, allocations, stock movements,
  backfill runs and candidates at zero. Cost revisions remained 15; currency configs/rates/rate
  revisions remained 7/35/35.
- No child capability was enabled, no export was triggered and no historical backfill was run.

Result: **Stage 07 PASS under the Owner-approved Option B exception.** The task can close as
CONDITIONAL because the product release and observation passed while physical restore and the
pre-existing full-history replay remain explicitly accepted, unresolved P0 recovery debt.
