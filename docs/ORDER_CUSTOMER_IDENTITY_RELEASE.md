# Order customer identity release runbook

Last verified: 2026-07-21
Owner: RepairDesk Integration Lead
Production approval: granted by Owner on 2026-07-21

## What changes

- New-order creation becomes one database transaction covering customer, device, order and creation event.
- A same-store phone match with a contradictory name returns `CUSTOMER_IDENTITY_CONFLICT` before business writes.
- Staff must explicitly use an existing customer or confirm a distinct customer sharing the phone number.
- New orders keep customer name/phone snapshots; legacy rows are compatibility-backfilled from the current profile.
- Bare Enter no longer selects the first name-search result.

The create route does not fall back to the legacy multi-write path. If the migration is missing, it returns `ORDER_CREATE_MIGRATION_REQUIRED` and performs no business writes.

## Release order

1. Obtain Owner approval for the production database change and deployment window.
2. Record current migration history and confirm an additive, forward-fix rollback path.
3. Apply `supabase/migrations/20260721114549_order_customer_identity_atomic_create.sql` before deploying the application code.
4. Verify the function exists and only `service_role` can execute it.
5. Deploy the application.
6. Run the smoke matrix below with synthetic customers only.

Do not deploy the application before the migration: order reads now select the snapshot columns and order creation intentionally fails closed without the RPC.

## Smoke matrix

| Scenario | Expected result |
|---|---|
| new phone + name | one customer, one device, one order, one creation event |
| same phone + same normalized name | existing customer reused; name unchanged |
| same phone + different name | HTTP 409; customer/device/order/event counts unchanged |
| choose existing customer | one atomic order; order snapshot equals selected customer |
| confirm shared phone | distinct customer and correctly linked order; original customer unchanged |
| repeat the same operation ID and hash | same order returned with replay marker |
| same operation ID with a different hash | `idempotency_conflict` |

Validate counts only within the synthetic store/test IDs. Do not include real customer names or phone numbers in release evidence.

## Offline behavior

The current production offline create RPC remains a fail-closed `blocked_operation` placeholder. This release does not enable offline order creation. A separate reviewed migration is required before the offline feature flag and server HMAC are enabled.

## Observation and rollback

Monitor `CUSTOMER_IDENTITY_CONFLICT`, `ORDER_CREATE_TRANSACTION_FAILED`, `ORDER_CREATE_MIGRATION_REQUIRED`, and idempotent replay rates without logging raw names, phone numbers or full request bodies.

If application problems appear after migration, roll back the application deployment while retaining the additive snapshot/ledger/challenge schema. Do not drop snapshot columns or delete challenges during incident response. If the RPC itself is faulty, disable new-order creation or deploy a forward fix; destructive schema rollback requires a separate approved recovery plan.
