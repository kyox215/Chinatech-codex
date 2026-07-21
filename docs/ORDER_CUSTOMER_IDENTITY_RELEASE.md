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
- Customer intake search accepts either the legacy `{ q }` request or a structured
  `{ phone, name, phoneMatchMode }` request. The two forms cannot be mixed.
- When both phone and name are present, phone is the hard candidate filter. Name only ranks
  or labels same-phone candidates; a similar name with a different phone is never returned.
- The new-order form renders one candidate list and keeps an explicit "create with the current
  details" action after a settled, trustworthy lookup. Historical devices remain below the
  customer selection flow instead of being nested inside every candidate row.

The create route does not fall back to the legacy multi-write path. If the migration is missing, it returns `ORDER_CREATE_MIGRATION_REQUIRED` and performs no business writes.

The structured intake-search change is application-only. It does not add or alter database
schema, RPCs, RLS policies or grants, and must not change the existing identity-conflict
challenge at order creation time.

## Lookup-only release order (TASK-010)

This customer lookup deployment does not run a database migration.

1. Verify the existing order-customer identity migration is already present in production.
2. Do **not** run `supabase db push` for this lookup-only change.
3. Deploy the application build.
4. Run the read-only phone-only, name-only and phone-plus-name lookup smoke checks with synthetic data.
5. Monitor identity conflicts and order-create transaction errors without logging raw customer identity.

If the existing identity migration is missing, stop the lookup deployment and use the separately
approved foundation release process below. Do not silently apply it as part of TASK-010.

## Initial atomic identity foundation release order

1. Obtain Owner approval for the production database change and deployment window.
2. Record current migration history and confirm an additive, forward-fix rollback path.
3. Apply `supabase/migrations/20260721114549_order_customer_identity_atomic_create.sql` before deploying the application code.
4. Verify the function exists and only `service_role` can execute it.
5. Deploy the application.
6. Run the smoke matrix below with synthetic customers only.

For an environment that has never received the foundation release, do not deploy identity-aware
application code before the migration: order reads select the snapshot columns and order creation
intentionally fails closed without the RPC.

## Smoke matrix

| Scenario                                | Expected result                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| new phone + name                        | one customer, one device, one order, one creation event                              |
| same phone + same normalized name       | existing customer reused; name unchanged                                             |
| same phone + different name             | HTTP 409; customer/device/order/event counts unchanged                               |
| choose existing customer                | one atomic order; order snapshot equals selected customer                            |
| confirm shared phone                    | distinct customer and correctly linked order; original customer unchanged            |
| repeat the same operation ID and hash   | same order returned with replay marker                                               |
| same operation ID with a different hash | `idempotency_conflict`                                                               |
| phone only                              | phone candidates are shown                                                           |
| name only                               | name candidates are shown                                                            |
| phone + different name                  | same-phone candidate remains with a warning; different-phone name matches are absent |
| settled lookup                          | exactly one candidate list and an explicit create-new action are available           |
| lookup error or offline                 | create-new is not presented as a verified no-match result                            |

Validate counts only within the synthetic store/test IDs. Do not include real customer names or phone numbers in release evidence.

## Offline behavior

The current production offline create RPC remains a fail-closed `blocked_operation` placeholder. This release does not enable offline order creation. A separate reviewed migration is required before the offline feature flag and server HMAC are enabled.

## Observation and rollback

Monitor `CUSTOMER_IDENTITY_CONFLICT`, `ORDER_CREATE_TRANSACTION_FAILED`, `ORDER_CREATE_MIGRATION_REQUIRED`, and idempotent replay rates without logging raw names, phone numbers or full request bodies.

If application problems appear after migration, roll back the application deployment while retaining the additive snapshot/ledger/challenge schema. Do not drop snapshot columns or delete challenges during incident response. If the RPC itself is faulty, disable new-order creation or deploy a forward fix; destructive schema rollback requires a separate approved recovery plan.
