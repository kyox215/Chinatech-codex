# Stage 07 — Production Release and Observation

Status: blocked at production gate — 2026-07-18T14:44:15Z

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

### Failed hard gates

1. **Recovery gate — FAIL.** `supabase backups list` reports `pitr_enabled=false`; there is no
   isolated restore drill, verified restore artifact, RPO/RTO or restore-owner proof. A visible
   completed backup is not proof that recovery works.
2. **Historical replay gate — FAIL.** The same-day clean replay still stops before TASK-008 at
   `20260611102805_repairdesk_remote_schema_compatibility.sql` because
   `inventory_items.product_channel` is absent. The Phase 2 schema-clone harness does not repair
   or certify the full repository recovery chain.
3. **Legacy security gate — FAIL.** The live database still has 17 public legacy tables with RLS
   disabled. Current Supabase security advisors also report seven overly permissive write policies:
   INSERT/UPDATE/DELETE on `orders`, INSERT/UPDATE/DELETE on `repair_quotes`, and ALL on
   `suppliers`. Five legacy functions also have mutable search paths. These findings predate
   TASK-008 but remain incompatible with the broad Database Application Gate.
4. **Observation gate — NOT STARTED.** Because migration apply, Git push and deployment were
   correctly stopped, no exact-SHA production smoke or observation window can be claimed.

## Stop decision

Result: **NO-GO / conditional delivery.** No linked migration was applied, no production data was
changed, no Phase 2 feature flag was enabled, `main` was not pushed and Vercel was not deployed.
This is the required outcome of a failing R4 production gate, not a partial hidden release.

The task can resume only after a separately scoped P0 recovery/security package:

1. reconstructs or repairs the full historical migration recovery baseline;
2. records a current backup/PITR strategy and completes an isolated restore drill with artifact,
   hashes, RPO/RTO and restore owner;
3. discovers consumers and safely handles the 17 RLS-disabled legacy tables plus the seven
   over-permissive write policies and mutable-path functions;
4. repeats fresh fetch, migration list, exact dry-run, advisors and pre/post release assertions.

Only then may this stage continue from migration apply step 6. The six migration files and all
application flags must remain unchanged and off in the meantime.
