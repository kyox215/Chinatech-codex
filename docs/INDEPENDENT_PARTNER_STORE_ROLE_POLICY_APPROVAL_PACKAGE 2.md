# Independent Partner Store Role Policy Approval Package

Last updated: 2026-07-05
Status: Owner approval package, not runtime enforcement
Task: `TASK-20260705-003-role-policy-approval-package`

## Purpose

RepairDesk needs a clear role and permission model before runtime enforcement is added for independent partner stores.

This package defines the recommended store role policy for approval. It does not change production permissions, database schema, RLS policies, Supabase configuration, or deployed behavior.

## Current Evidence

- Current store role enum: `owner`, `manager`, `technician`, `sales`, `viewer` in `src/lib/repairdesk/types.ts`.
- Product wording should treat `sales` as `frontdesk / 前台`; schema renaming can be considered later but is not required for enforcement.
- Store invitations, invite links, and join approvals already block granting `owner` through public/member join paths.
- `assertStaffRole` exists in `src/server/auth-context.ts`, but route-level business permissions are not yet centralized.
- Inventory writes currently use a coarse write gate for `owner`, `manager`, `technician`, and `sales`.
- Some order workflow configuration paths already require `owner` or `manager` inside order repository code.
- Many order, customer, message, payment, settings, and member actions still need a unified server-side permission map before runtime enforcement.
- The app uses server-side Supabase service-role repositories for business data, so RLS is defense in depth. Role-level enforcement must be implemented in server permissions, route gates, and service/object checks first.
- Order list CSV export is currently client-side from loaded rows. Future role enforcement must move export to a server-authorized, audited path before export permissions can be considered enforced.
- Order detail and attachment paths include sensitive unlock data and signed URLs. Future role enforcement must add field-level read authorization and sensitive-read audit events.

Supabase guidance checked on 2026-07-05:

- Exposed schemas need RLS enabled and explicit grants/policies.
- Policies should use `TO authenticated` with ownership or membership predicates, not authentication alone.
- `UPDATE` policies need both `USING` and `WITH CHECK`, and a matching `SELECT` policy.
- User-editable `user_metadata` must not be used for authorization; authorization data belongs in trusted app metadata or database tables.
- Service role keys bypass RLS and must never be exposed to clients.

Sources:

- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Securing your API docs: https://supabase.com/docs/guides/api/securing-your-api

## Role Vocabulary

| Product label | Current code value | Scope | Notes |
|---|---|---|---|
| Owner / 店主 | `owner` | One store | Full store controller. Must always retain access. |
| Manager / 店长 | `manager` | One store | Trusted daily operator. Can manage operational settings, but not owner-only privacy controls by default. |
| Technician / 技师 | `technician` | One store | Repairs and technical task execution. |
| Frontdesk / 前台 | `sales` | One store | Intake, customer communication, quote/payment counter work. Current enum name is `sales`. |
| Viewer / 查看者 | `viewer` | One store | Read-only collaborator with narrow visibility. |
| Platform owner | platform admin flag | Platform | System/cooperation control only; no default store business-data visibility. |
| Platform support | future support role/scope | Platform | Can view store business data only after owner-granted, time-limited support access. |

## Non-Negotiable Invariants

- Every active store must always have at least one active `owner` membership.
- A user role is scoped to one store only; a `manager` in Store A has no rights in Store B.
- `owner` can be created by independent store creation or a future owner-transfer workflow only.
- Join requests, direct invitations, and invite links must never create or approve `owner`.
- Platform admin status is not store business permission.
- Unknown, null, or stale roles default to deny, except for a verified active owner fallback during rollout.
- Frontend visibility is never the authority boundary.

## Recommended Default Decisions

These are the defaults recommended for Owner approval.

| Decision | Recommendation | Reason |
|---|---|---|
| Manager support grants | Owner-only for v1 | Support access reveals private store business data; let manager request, but owner grants. |
| Technician unlock credentials | Allowed only on assigned/active repair tasks, audited | Needed in repair work, but sensitive enough to avoid broad list/export access. |
| Frontdesk payment collection | Allowed for normal collection; manager/owner needed for correction/refund/override | Reception needs speed at pickup, but adjustments can affect money records. |
| Viewer exports | Not allowed by default | Export is high-risk bulk data movement. |
| `sales` rename to `frontdesk` | Keep enum for v1, change UI label first | Avoid migration risk; future schema rename can be separate. |
| Platform support write access | Not in v1 | Start read-only and audited; write support is a separate approval. |
| Manager granting manager role | Owner-only for v1 | A manager can manage staff, but creating another manager changes authority structure. |
| Last owner demotion/removal | Never allowed | Store must not become ownerless. |

## Permission Matrix

Legend:

- `Y`: allowed by default.
- `A`: allowed with audit.
- `R`: restricted or requires elevated approval.
- `N`: not allowed by default.
- `S`: scoped only, normally assigned/active items.

| Capability | owner | manager | technician | frontdesk (`sales`) | viewer |
|---|---:|---:|---:|---:|---:|
| Open store workspace | Y | Y | Y | Y | Y |
| View order list/detail | Y | Y | S | Y | S |
| Create order | Y | Y | Y | Y | N |
| Edit intake/customer/device fields | Y | Y | S | Y | N |
| Edit diagnosis/repair notes | Y | Y | Y | S | N |
| Transition order workflow | Y | Y | Y | Y | N |
| Configure workflow statuses/transitions | Y | Y | N | N | N |
| Upload/view order photos | Y | Y | Y | Y | S |
| View unlock credentials | A | A | S/A | R | N |
| Send customer messages | Y | Y | S | Y | N |
| Create/update customer profile | Y | Y | S | Y | N |
| Customer tags/follow-ups | Y | Y | S | Y | N |
| Export customers/orders | A | R | N | N | N |
| Create/update inventory item | Y | Y | Y | Y | N |
| Inventory quality check | Y | Y | Y | N | N |
| Inventory sale/transfer/loss adjustment | A | A | R | R | N |
| Configure store settings | Y | Y | N | N | N |
| Configure message templates | Y | Y | N | N | N |
| Invite/revoke members | Y | Y | N | N | N |
| Approve join requests | Y | Y | N | N | N |
| Change member roles | Y | R | N | N | N |
| Remove owner / transfer ownership | R | N | N | N | N |
| Grant platform support access | A | N | N | N | N |
| View support access audit | Y | Y | N | N | N |
| Platform admin store metadata | platform only | - | - | - | - |
| Platform admin business data without grant | N | N | N | N | N |

## High-Risk Operations

These must be server-authorized and audited before runtime enforcement is considered complete.

1. Member invitation, revocation, role change, and join approval.
2. Store settings, workflow configuration, and message template changes.
3. Payment collection, finance correction, refund/void, and marked-paid state.
4. Customer/order export and any bulk data download.
5. Device unlock credential read.
6. Attachment/photo access through support mode.
7. Platform support grant, revoke, expiration, and every support-mode data access.
8. Inventory sale, transfer, write-off, or high-value adjustment.
9. Client-side or server-side exports containing customer, phone, IMEI, payment, issue, or message content.
10. Last-owner demotion, removal, deactivation, or transfer.

## Runtime Enforcement Design

### 1. Single Permission Map

Create a shared server permission module, for example `src/server/permissions.ts`.

The module should expose:

- `PermissionAction` constants such as `order:create`, `customer:update`, `payment:collect`, `support:grant`.
- `rolePermissions` default matrix for store roles.
- `assertPermission(actor, action, context)` for route and service use.
- `can(actor, action, context)` for UI affordances and non-authoritative display hints.

Rules:

- Default deny when role is missing or unknown.
- `owner` fallback must stay accessible during rollout.
- `actor.isSystem` requires explicit internal path, not blanket permission for user routes.
- Platform admin status is not store business permission.
- `frontdesk` is an alias only; the v1 internal permission role remains `sales`.
- Last active owner checks must happen before member role downgrade, deactivation, revocation, or transfer.

### 2. Route-Level Gates

Add route-level authorization in `src/server/api/repairdesk-router.ts`.

Recommended grouping:

- Read business data.
- Create/update business data.
- Finance/payment.
- Workflow/settings.
- Member/admin.
- Export/support.

Route gates should stop low-permission roles before service calls and produce Chinese user-facing 403 messages that do not leak store/customer identifiers.

### 3. Service and Object-Level Gates

Route gates are not enough. High-risk services should also verify:

- Active store membership.
- Same-store object ownership.
- Assigned order/task scope if `technician` is scoped.
- Finance correction vs normal collection distinction.
- Unlock credential access scope.
- Signed attachment URL access scope.
- Server-side export scope and audit metadata.

### 4. Database / RLS Defense in Depth

Do not rely only on client UI or route checks.

Before production enforcement:

- Verify every business table has `store_id` and RLS enabled where exposed.
- Verify membership-based RLS policies use store membership predicates.
- Verify `UPDATE` policies include both `USING` and `WITH CHECK`.
- Verify role checks do not use user-editable `user_metadata`.
- Verify indexes exist for policy predicates such as `(store_id, role, status)`, `(user_id, status)`, and business object `(id, store_id)`.
- Verify service-role-only server routes do not expose service role credentials to clients.
- Do not attempt column-level privacy solely through RLS. Unlock credentials, signed URLs, and export fields need server-side projection/redaction.

### 5. UI Affordances

UI should hide or disable unauthorized actions for clarity, but this is not the authority boundary.

Required states:

- Disabled action with short reason.
- Missing-permission 403 handling.
- Owner-only labels for support grant/export/member role change.
- Frontdesk label shown as `前台` even while enum remains `sales`.

## Implementation Phases

### Phase A: Approval and Final Matrix

Output:

- Owner approves or edits the decision defaults above.
- Confirm whether `sales` remains internal value for frontdesk.
- Confirm high-risk permission defaults.

Exit criteria:

- No unresolved Owner decisions for v1 runtime enforcement.

### Phase B: Server Permission Module

Output:

- Add `src/server/permissions.ts`.
- Add unit tests for every role/action pair.
- No route behavior changes until gates are wired.

Exit criteria:

- Matrix tests pass and owner role fallback is proven.

### Phase C: Route Gates

Output:

- Wire `assertPermission` into `repairdesk-router.ts`.
- Start with high-risk writes: settings, workflow, members, invite links, finance corrections, payment override, exports/support.
- Add API tests for allowed/denied roles.

Exit criteria:

- Unauthorized roles receive 403 before service mutation.
- Existing owner/manager happy paths pass.

### Phase D: Object-Level and Sensitive Reads

Output:

- Add service/repository checks for assigned repair tasks, unlock credentials, and exports.
- Move bulk export behind a server endpoint with `export:*` permission and audit.
- Create attachment signed URLs only after `attachment:read` permission passes.
- Add audit events for sensitive reads.

Exit criteria:

- Cross-store and cross-role denial tests pass.
- Sensitive reads are auditable.

### Phase E: UI Cues

Output:

- Hide/disable actions based on `can()`.
- Keep server 403 handling as final authority.

Exit criteria:

- Mobile and desktop major workflows show clear permission states.

### Phase F: Production Preflight and Release

Output:

- Supabase schema/RLS/storage verification plan.
- Rollback plan and observation window.
- Release checklist with owner approval.

Exit criteria:

- Production preflight completed and release explicitly approved.

## Test Plan

Minimum automated tests:

- Permission matrix unit tests for every action and role.
- Router tests for high-risk action denial.
- Repository/service tests for object-level same-store and assigned-scope checks.
- Existing onboarding/invite tests to confirm `owner` cannot be granted by join/invite.
- RLS migration text tests or database integration tests for required policy patterns.
- Alias tests proving `frontdesk` is UI/product wording only and `sales` remains the v1 internal role.
- Last-owner protection tests for role change, revocation, deactivation, and transfer.
- Export denial/audit tests.
- Unlock credential and signed attachment URL denial/audit tests.

Minimum manual checks:

- Owner can still access settings, members, orders, customers, inventory, payments.
- Manager can run daily operations but cannot grant platform support if v1 owner-only is approved.
- Technician can complete repair work without seeing exports/member controls.
- Frontdesk can create orders and collect normal payments without settings/member controls.
- Viewer can read allowed records only and cannot mutate.

## Production Preflight

Run only after Owner approval.

```sql
-- stores with no active owner
select s.id, s.name
from public.stores s
where s.status = 'active'
  and not exists (
    select 1
    from public.store_memberships sm
    where sm.store_id = s.id
      and sm.role = 'owner'
      and sm.status = 'active'
  );

-- unexpected membership roles
select role, count(*)
from public.store_memberships
group by role;

-- invite paths must not grant owner
select id, email, role, status
from public.store_invitations
where role = 'owner';

select id, label, role, status
from public.store_invite_links
where role = 'owner';

-- join requests must not request or approve owner
select count(*)
from public.onboarding_requests
where request_type = 'join_store'
  and (requested_role = 'owner'::public.staff_role or approved_role = 'owner'::public.staff_role);

-- unvalidated constraints left behind after tenant hardening migrations
select conrelid::regclass, conname
from pg_constraint
where connamespace = 'public'::regnamespace
  and not convalidated;
```

Additional checks:

- Confirm RLS enabled on exposed business tables.
- Confirm no frontend bundle contains service role keys.
- Confirm audit log sanitizer still redacts secrets, unlock patterns, long messages, and attachment-sensitive fields.
- Confirm client-side export paths are removed or disabled for roles without server-side export permission.
- Confirm signed URL generation is only in server paths with permission checks.

## Rollback Strategy

Runtime enforcement should be released behind a feature flag or conservative switch.

Rollback options:

1. Disable route-level enforcement while keeping owner/member store isolation.
2. Preserve owner-only emergency access.
3. Revert UI affordance hiding if it blocks staff, while keeping server deny logs for diagnosis.
4. Never disable `store_id` isolation or tenant guardrails as a rollback.

## Owner Approval Request

Recommended approval:

1. Use the matrix above for v1.
2. Keep `sales` as internal enum, display it as `前台`.
3. Make support grants owner-only in v1.
4. Let frontdesk collect normal payments but require manager/owner for corrections/refunds/overrides.
5. Let technicians view unlock credentials only for assigned/active tasks, with audit.
6. Do not allow viewer exports.
7. Let managers manage technician/frontdesk/viewer, but require owner for manager role grants.
8. Block removal, downgrade, or deactivation of the last active owner.

Decision needed before implementation:

- Approve the recommended defaults, or mark specific rows to change.

Default if no decision:

- Do not implement runtime enforcement yet; continue with read-only planning and production preflight preparation only.
