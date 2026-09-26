# Orders remediation database verification

Migration: `20260926093439_order_workflow_atomic_and_transition_receipts.sql`.

Three additive, service-role-only, `SECURITY INVOKER` RPCs with fixed empty `search_path`:

- `repairdesk_order_transition_receipt(uuid,uuid,uuid,uuid,text)` checks active store/profile/membership and current technician assignment before reading the event receipt. Request identity is computed by the server from actor, order, expected version, target and reason. It shares the write RPC's store/operation advisory lock.
- `repairdesk_apply_order_transition(uuid,uuid,uuid,timestamptz,jsonb,text,jsonb,uuid)` holds the lifecycle/operation locks and current authorization row locks through the atomic mutation. It rechecks permission after waiting, avoiding stale authorization, and replays the original timestamp.
- `repairdesk_save_order_workflow(uuid,uuid,text,jsonb)` serializes each store's configuration writes. Default switching plus status insertion/update, and disabling plus replacing transition edges, commit in one transaction. Exceptions propagate without partial write fallback.

## Deployment and recovery

1. Verify the target project; apply this migration **before** deploying the new server/client together. Required existing objects are the workflow tables and `repairdesk_apply_order_atomic_mutation` from the current migration chain. No table rewrite, backfill, data deletion or extra role/table grants.
2. Verify all three RPC signatures, invoker rights, empty search path, and anon/authenticated EXECUTE denial. Application calls fail closed if the RPC is unavailable; do not restore the former sequential-write fallback.
3. Clients must send each selected order's original `expected_updated_at` and stable UUID. The HTTP batch contract is now `{items:[{id,expected_updated_at,idempotency_key}],to}` (1–100 distinct items), replacing `{ids,to}`. Stale clients need a reload. Single transitions require both fields.
4. Keep a recoverable application release reference. On an application rollback, **retain the additive RPCs**; the old application does not call them. Dropping functions is unnecessary for recovery and requires all new callers to be stopped. Restoring old application code also restores its known concurrency/retry defects, so pause affected writes while fixing forward.
5. Stop rollout on unexpected grants, unavailable function signatures, transaction errors, or regression in tenant/actor denial. A store-wide advisory lock can briefly queue concurrent configuration edits; there are no table rewrites. Real production schema/volume and permission checks remain release responsibilities.

Previously committed transitions have no `transition_request_hash`; a retry with those old keys fails closed as an idempotency conflict. New successful transitions preserve the original `{ok,from,to}` receipt after later status changes. Existing device snapshots that already lost their empty override cannot be distinguished from legacy absent notes; this change prevents future loss, with no speculative backfill.

## Isolated verification

Only use a fresh, task-owned PostgreSQL 17 database. `orders_remediation_bootstrap.py` prints minimal synthetic domain tables and **the exact repository workflow table DDL, existing atomic mutation function, production lifecycle write guard and new migration**. The current production lifecycle trigger body is included verbatim; its unrelated purge-worker authorization helper is stubbed to always deny in this order-only fixture. No purge or inventory-attachment mutation is exercised. It does not connect to a database. This fixture is not a full production-schema or production-data verification.

```sh
python3 supabase/tests/orders_remediation_bootstrap.py | docker exec -i repairdesk_orders_remediation_20260926 psql -U postgres -v ON_ERROR_STOP=1
docker exec -i repairdesk_orders_remediation_20260926 psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/orders_remediation_atomic.sql
python3 supabase/tests/orders_remediation_races.py --container repairdesk_orders_remediation_20260926
```

Atomic SQL covers rollback after late status/edge write failure, unique-constraint failure during default creation, access grants, cross-store and unassigned technician denial, stale versions, completed-order replay, changed request hash, revoked membership and suspended store. Nine real two-connection races cover same-operation deduplication, competing same-version writes, concurrent default switches, complete edge-set replacement, membership revocation while workflow/receipt/transition writes wait, staff suspension while waiting, and store lifecycle pause locking without deadlock. All data is synthetic. The fixture is one-use; repeat in a newly provisioned task database rather than deleting an unrelated database.
