---
schema_version: 1
task_id: "TASK-20260706-001-realtime-updates-execution"
status: "draft_owner_approval_required"
created_at: "2026-07-06T13:36:32Z"
---
# Supabase Realtime Authorization Approval Package

## Decision Requested

Approve or reject applying the local migration draft:

- `supabase/migrations/20260706133632_repairdesk_realtime_private_broadcast_authorization.sql`

This package does not apply the migration. It only records the proposed production change, required manual checks, rollback path, and release gates.

## Current Local State

Implemented locally and verified:

- Client subscription shell uses private store-domain topics: `repairdesk:v1:store:<store_uuid>:<domain>`.
- Client feature flag remains default-off: `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED === "1"`.
- Server Broadcast remains default-off: `REPAIRDESK_REALTIME_BROADCAST_ENABLED === "1"`.
- Server emits only allowlisted invalidation metadata after successful mutations.
- No order/customer/inventory entity ids, phone, email, amount, notes, unlock values, attachment URLs, message body, invite tokens, or raw DTOs are broadcast.

## Proposed Database Change

The migration draft:

- Enables RLS on `realtime.messages`.
- Revokes anonymous access to `realtime.messages`.
- Revokes `INSERT`, `UPDATE`, and `DELETE` on `realtime.messages` from public/authenticated browser roles.
- Grants `SELECT` on `realtime.messages` to `authenticated`.
- Adds a `FOR SELECT TO authenticated` policy for Broadcast-only messages.
- Allows a user to join a topic only when:
  - `realtime.messages.extension = 'broadcast'`;
  - `realtime.topic()` matches `repairdesk:v1:store:<uuid>:(orders|customers|inventory|settings)`;
  - `auth.uid()` has an active `public.store_memberships` row for that store;
  - the linked `public.stores` row is active.
- Intentionally adds no `INSERT` policy for browser clients.

## Required Supabase Dashboard Setting

Before enabling app flags, in Supabase Realtime Settings:

- Disable `Allow public access`.

Official Supabase documentation states private channel enforcement requires disabling that setting in addition to `realtime.messages` RLS policies.

## Security Review

Threat model:

- Asset: store-scoped business data in orders, customers, inventory, settings.
- Attackers: authenticated user from another store, invited but inactive member, anonymous user, compromised browser trying to send fake invalidation events.
- Entry point: Realtime private Broadcast subscription.
- Desired trust boundary: only active members of the topic store can receive that store's invalidation signals; browser clients cannot send business Broadcast messages.

Security controls:

- Exact topic namespace: `repairdesk:v1:store:<uuid>:<domain>`.
- Store access is checked through `public.store_memberships` and `public.stores`.
- Policy is `FOR SELECT` only.
- Browser `INSERT` is revoked and no browser insert policy exists.
- Payload allowlist is enforced in app code before send and before receive.

Known limits:

- Supabase Realtime evaluates access when a client joins and caches access for the connection duration. Membership changes require reconnect/JWT refresh to take full effect.
- The Dashboard `Allow public access` setting is not represented in this SQL migration and must be checked manually.
- Production schema state has not been remotely audited in this turn.

## Data Migration Review

Schema/data impact:

- No user business table is altered.
- No data backfill is required.
- No row rewrite or large index build is introduced.
- RLS/policy changes affect Realtime connection authorization only.

Lock/performance risk:

- `alter table realtime.messages enable row level security` and policy/grant statements are metadata operations.
- Join latency can increase if the RLS predicate is expensive. The predicate uses existing indexed membership fields: `store_memberships(user_id, status)` and `stores(id)`.

Compatibility:

- Existing local client code already uses `config: { private: true }`.
- Server Broadcast uses service role and remains default-off.
- Existing browser clients will not receive anything until both app flags and Supabase private authorization are enabled.

## Pre-Apply Checklist

1. Confirm target Supabase project and environment.
2. Confirm latest production schema includes:
   - `public.store_memberships(store_id, user_id, status)`;
   - `public.stores(id, status)`;
   - `realtime.messages`;
   - `realtime.topic()`.
3. Confirm `store_memberships_user_status_idx` or equivalent index exists.
4. Confirm no current app feature depends on authenticated browser clients inserting into `realtime.messages`.
5. In Supabase Dashboard, disable Realtime `Allow public access`.
6. Run a dry review of current `realtime.messages` policies before applying.
7. Approve a maintenance window if the project is live.

## Post-Apply Verification

Run after migration is applied to a non-production environment first:

1. Anonymous client cannot subscribe to `repairdesk:v1:store:<store_uuid>:orders`.
2. Authenticated user without active membership cannot subscribe to another store's topic.
3. Active member can subscribe to own store topic.
4. Authenticated browser client cannot send a business Broadcast.
5. Server-side service role Broadcast reaches active members.
6. Two tabs on the same store refresh query data without manual reload after a mutation.
7. Cross-store user does not receive the event.

## Rollback

If private channel access blocks legitimate users:

```sql
drop policy if exists repairdesk_realtime_store_broadcast_receive
  on realtime.messages;

revoke select on table realtime.messages from authenticated;
```

Operational rollback:

- Set `NEXT_PUBLIC_REPAIRDESK_REALTIME_ENABLED` off.
- Set `REPAIRDESK_REALTIME_BROADCAST_ENABLED` off.
- Redeploy/restart environment so clients stop subscribing and server stops sending.

## Approval Boundary

Owner approval is required before:

- applying the migration to any remote Supabase project;
- changing Supabase Realtime Dashboard settings;
- enabling either realtime app flag in production;
- deploying or pushing production release changes.
