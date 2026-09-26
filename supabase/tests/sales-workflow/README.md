# Sales daily workflow database verification

This suite uses only the existing `repairdesk_sales_release_20260907` synthetic PostgreSQL 17 container, requires `network=none`, and creates a unique `sales_workflow_*` database. It does not use environment files or production credentials. The fixed password belongs to that synthetic fixture container. Run from the worktree:

```sh
bash supabase/tests/sales-workflow/run-pg17.sh
```

Evidence is written to `artifacts/sales-daily-workflow-20260926/backend/`, including server version, source hashes, pgTAP results and independent-session race results. The historical sales bootstrap is a reduced source-derived schema; the suite applies the real permission-grant migrations and the real new migration. It does not prove complete production schema equivalence.

## Data and authorization

The additive migration creates workflow state, issues and immutable events keyed by sale order and store. Same-store foreign keys also constrain assignee membership. Original sale, payment, stock and warranty facts are never updated by workflow commands. Every accepted workflow mutation, event and inventory revision is committed atomically. Any late SQL error rolls back those effects.

The three service-only RPCs validate active staff, membership and store from the database. Eligible roles are owner, manager and sales; only owner or manager can verify fiscal documents. Browser roles and service role have no direct table privileges, and all new tables have RLS. Event payloads contain private operational notes and must not be published or put in realtime messages; the BFF broadcasts invalidation metadata only.

A manager's finance access additionally requires an active `finance:aggregate_read` grant matching store, membership and user. Membership/profile/store rows and an applicable grant are share-locked during RPC execution, so a revocation waits for an already-authorized transaction and subsequent calls see the revocation. Replay is authorized before the stored response is returned. A changed actor or request conflicts; concurrent initial commands serialize before the version-zero CAS check.

## Report semantics

Sales are attributed by `inventory_sale_orders.agreed_at`; receipts by payment-entry `occurred_at`. Rome calendar midnights form half-open intervals, including 23-hour spring and 25-hour autumn days. Mirrored inventory transactions are never summed. Ledger discrepancy is **current whole-store** `order.paid_cents - sum(payment_entries.amount_cents)`, independent of the selected business date. Pending counts also reflect current state rather than a historical snapshot.

Sales staff see orders assigned to their membership or created by them while unassigned. Owner/manager see store pending work. Finance totals are null when unauthorized. Pending rows are paginated independently of counts. Per-order reads return at most 100 issues (open first) and 50 recent events, with explicit `truncated` indicators.

The SQL suite exercises malformed input, cross-store access/FKs, membership and staff revocation, suspended stores, revoked finance grants, replay conflicts, fiscal correction and verification reset, issue resolution, append-only audit, late-failure atomicity, report scopes, mismatches and both DST boundaries. It injects one unmatched payment inside the rolled-back fixture solely to verify discrepancy detection. Independent sessions additionally prove competing version-zero commands and same-key races produce exactly one event and issue per order.

## Migration and recovery

There is no data backfill and no old-column or old-RPC replacement. Existing orders have implicit workflow version 0 until the first accepted command. New tables and their indexes are empty at installation. Two indexes are built on existing sales/payment tables for store/date reporting; normal `CREATE INDEX` can block writes while scanning those tables. The migration uses a 5-second lock timeout and 60-second statement timeout and runs transactionally. Production relation sizes and a suitable low-traffic window must be checked before applying; synthetic success is not a production lock-duration estimate.

Apply the additive migration before deploying the new BFF. If RPCs/tables are unavailable, the BFF returns 503; there is no mock success. Preserve existing sales rollout flags. During recovery, roll back the application to the verified deployment and retain the additive tables/event data for investigation. If workflow access itself must be disabled, revoke EXECUTE on the three new public RPCs from `service_role` in an approved recovery migration. Do not drop workflow tables or remove event history as a rollback step. The original transaction paths remain compatible with the added tables.

Stop release for failed authorization/CAS tests, incomplete production schema preflight, migration timeout, missing required grant schema, unexpected totals or a release-blocking security review. Re-running this script creates another isolated database and never reuses or drops an existing fixture database.
