# Permission Matrix Baseline — TASK-20260620-004

- Task: `TASK-20260620-004`
- Scope: authentication, roles, tenant isolation, platform admin, sensitive business actions, approval boundaries.
- Mode: L2 controlled execution.
- Code/data changes: none. This report is evidence and governance only.
- Verification posture: local repository inspection plus non-destructive checks. Production Supabase, Vercel, live roles, backups, retention, and remote RLS parity are not verified by this task.

## Executive Conclusion

RepairDesk has a clear store-scoped server model: `/api/repairdesk/*` resolves a request actor, chooses an active store, and most repositories require strict store context through `requireStoreIdFromActor`. Platform onboarding approval is separated behind `platform_admins`. Several high-risk write surfaces are role-gated, especially inventory, message settings, member invitations, and workflow configuration.

The main permission gap is inside active store membership: current evidence shows many order and customer mutations are protected by authentication plus store context, but not by an explicit staff-role gate at the router/repository level. If a `viewer` membership can call those API routes, it appears able to mutate orders, payments, customer records, messages, attachments, and approval actions. That may be intentional for a small shop only if `viewer` is not used operationally, but it is not yet a verified business policy.

No confirmed P0 vulnerability was proven by local inspection alone. The highest P1 items are role-policy ambiguity for order/customer writes, production permission parity unknown, audit-log minimization, and self-service store creation outside the platform approval path.

## Actors and Roles

| Actor | Verified source | Current meaning | Status |
|---|---|---|---|
| Anonymous browser/API caller | `src/proxy.ts`, `src/utils/supabase/proxy.ts` | Redirected/401 when browser Supabase config exists; bypassed in local/no-config or E2E-bypass mode. | verified local code |
| Authenticated user without active store | `src/server/auth-context.ts` | Normal API is forbidden unless route allows pending store; onboarding/platform paths allow pending store. | verified local code |
| Store member: `owner` | `src/lib/repairdesk/types.ts`, `src/server/auth-context.ts` | Highest store role; can pass owner/manager gates. | verified local code |
| Store member: `manager` | same | Can pass owner/manager gates. | verified local code |
| Store member: `technician` | same | Can write inventory by router gate; does not pass owner/manager gates. | verified local code |
| Store member: `sales` | same | Can write inventory by router gate; does not pass owner/manager gates. | verified local code |
| Store member: `viewer` | same | Has active store context but does not pass owner/manager or inventory write gates. Other write APIs require policy decision. | verified risk |
| Platform admin | `src/features/platform/server/platform.repository.ts` | Can list/approve/reject onboarding requests; separate from store role. | verified local code |
| System/mock actor | `src/server/auth-context.ts`, `src/server/audit.ts` | Used when browser auth config is missing or internal code passes system actor; role checks let `isSystem` pass. | verified local code, production-risk context unknown |

## Verified Permission Matrix

| Surface / action | Current verified control | Explicit roles | Evidence | Gap / decision |
|---|---|---|---|---|
| API request actor resolution | `getRequestActor(true)` on RepairDesk GET/POST routes; active store required unless pending-store route. | active store membership or platform-pending route | `src/server/api/repairdesk-router.ts`; `src/server/auth-context.ts` | Production depends on Supabase config being present. |
| Login/session protection | Proxy redirects pages and returns 401 for API when Supabase auth config exists. | authenticated user | `src/proxy.ts`; `src/utils/supabase/proxy.ts` | Local/no-config and E2E bypass intentionally disable auth. |
| Tenant isolation in app repositories | Real order/customer/inventory repos use `requireStoreIdFromActor`; tenant guard test blocks legacy `storeIdFromActor` usage. | active store context | `src/server/tenant-guard.test.ts`; repo scans | Production DB parity still unknown. |
| Platform onboarding list/approve/reject | `assertPlatformAdmin(actor)`. | platform admin only | `src/features/platform/server/platform.repository.ts` | Live platform admin membership unknown. |
| Store create | Requires logged-in non-system actor, then creates owner membership. | any authenticated actor | `src/features/stores/server/store.repository.ts` | Decide whether self-service store creation is allowed or must require platform approval. |
| Store switch | Membership asserted before setting cookie. | active member of target store | `src/features/stores/server/store.repository.ts` | No immediate gap. |
| Invite store member | `assertCanManageStoreMembers`. Invited role cannot be owner. | owner/manager | `src/features/stores/server/store.repository.ts`; `src/lib/repairdesk/types.ts` | No immediate gap. |
| List store members/invitations | Requires active store context. | any active store member | `src/features/stores/server/store.repository.ts` | Decide if viewer/sales/technician should see member roster. |
| Message settings/template update/reset | `assertStaffRole(actor, ["owner", "manager"])`. | owner/manager | `src/features/messages/server/message-settings.service.ts` | Audit metadata may include raw template/settings input. |
| Message template preview | Requires active store context. | any active store member | same | Likely acceptable, but policy not confirmed. |
| Inventory writes/import/sell/attachments | Router calls `assertInventoryWrite`; repos require store context. | owner/manager/technician/sales | `src/server/api/repairdesk-router.ts`; `src/features/inventory/server/inventory.repository.ts` | `viewer` correctly excluded by current code. |
| Order workflow config create/update/reorder/enable/transitions | Repository gates with owner/manager; `setOrderWorkflowStatusEnabled` delegates to gated update. | owner/manager | `src/features/orders/server/order.repository.ts` | No immediate gap. |
| Order create/update/patch/finance/payment/transition/batch/attachments/notifications/approval | Router resolves authenticated actor; repository requires store context; no explicit staff-role gate found in current scan. | active store member, role policy not explicit | `src/server/api/repairdesk-router.ts`; `src/features/orders/server/order.repository.ts` | P1: viewer/role write policy needs Owner decision and tests. |
| Customer create/update/device/tag/followup/message | Repository requires store context; no explicit staff-role gate found in current scan. | active store member, role policy not explicit | `src/features/customers/server/customer.repository.ts` | P1/P2: customer PII mutation policy needs Owner decision and tests. |
| Attachments direct storage | Migration comments and grants indicate server-routed private storage posture. | service-role server path | `supabase/migrations/20260619193655_repairdesk_attachment_storage_repair.sql` | Remote bucket/policy parity unknown. |
| Audit logs | Server writes audit rows through service role; generic router stores input metadata. | server-side only by app path | `src/server/audit.ts`; `src/server/api/repairdesk-router.ts` | P1: redaction/minimization policy missing. |
| Owner/platform bootstrap script | Requires Supabase URL, service-role key, admin password; creates owner, store membership, platform admin, audit log. | operator with secrets | `scripts/ensure-owner-admin.ts`; `tests/ensure-owner-admin.test.ts` | D3/D4 approval for live use; do not run in L2. |

## Data and Tenant Controls

| Layer | Verified fact | Evidence | Unknown |
|---|---|---|---|
| Application tenant guard | Active store is resolved before most business data access; strict helper throws when store context is missing. | `src/server/auth-context.ts`; `src/server/repairdesk-shared.ts`; `src/server/tenant-guard.test.ts` | Whether every future repository keeps the pattern. |
| Database constraints | Tenant-hardening migration adds/validates store foreign keys and same-store constraints across orders, customers, inventory, audit, settings, and templates. | `supabase/migrations/20260611005916_harden_store_tenant_constraints.sql` | Whether this migration is applied remotely. |
| RLS policies | Migration adds member SELECT policies for tenant tables and self SELECT for profiles/memberships. | same migration | Earlier migrations revoke broad direct table grants; remote grants/policies are not verified. |
| Service-role path | Server repositories use Supabase admin/service client, so application authorization remains the decisive write control. | repository imports and patterns | Remote key handling and deployment environment not verified. |

## Verified Facts, Assumptions, Conflicts, Unknowns

### Verified Facts

- Staff roles are `owner`, `manager`, `technician`, `sales`, and `viewer`.
- Platform admin status is a separate authorization dimension.
- `getRequestActor` creates or resolves staff profile/membership context and blocks normal API access without active store unless the route allows pending store.
- `assertStaffRole` bypasses role checks for `actor.isSystem`.
- Inventory writes are role-gated to owner/manager/technician/sales.
- Message settings/template writes and order workflow configuration are role-gated to owner/manager.
- Order/customer write surfaces have strict store context but no explicit role gate found in this task scan.
- Local migrations model store tenancy, same-store constraints, platform onboarding, audit logs, and private attachment storage.
- No production data, live Supabase role, secret, migration, or deployment operation was performed.

### Assumptions

- Production should have browser Supabase config present; otherwise no-config fallback would be unsafe.
- `viewer` is intended to be read-only or low-privilege unless Owner confirms a different shop policy.
- Store members may reasonably read basic store context, but staff roster visibility may need narrower rules.
- Audit logs are useful for accountability, but should not retain more PII/payment/message payload than necessary.

### Conflicts

- Governance says sensitive permissions and production data require explicit Owner approval, but current local code allows self-service store creation by any authenticated user. This may be intentional onboarding behavior or a policy conflict.
- The UI may hide some actions by role, but server-side evidence is the authority for permission enforcement; UI-only restrictions are not sufficient.

### Unknowns

- Live Supabase migrations, RLS policies, direct grants, storage policies, buckets, service-role environment, and platform admin memberships.
- Whether `viewer`, `sales`, and `technician` are real production roles or mostly future placeholders.
- Whether audit log readers exist in UI/API and who can access them.
- Whether message-sending/approval actions should require manager/owner approval or be allowed for front-desk staff.

## P0/P1/P2 Risks and Technical Debt

| Priority | ID | Risk / debt | Evidence | Owner | Required next step |
|---|---|---|---|---|---|
| P0 | none verified | No confirmed active exploit or production misconfiguration was proven by local inspection. | local scan only | Integration Lead | Reclassify immediately if live Supabase audit finds open grants, missing auth config, or wrong platform admin state. |
| P1 | SEC-PERM-20260620-001 | Store `viewer` may be able to mutate order/customer/payment/message/attachment/approval APIs if it has an active store membership. | no role gate found on those write surfaces; store context only | Security + Backend + Owner | Owner policy decision, then add server tests and role gates if viewer should be read-only. |
| P1 | DATA-PERM-20260620-001 | Production Supabase permission and migration parity are unknown. | local migrations only | Data + Security + Owner | D3-approved remote read-only audit before production operations. |
| P1 | SEC-AUDIT-20260620-001 | Audit metadata/before/after may store raw PII, payment, message, or attachment inputs. | `auditGeneric` stores `metadata.input`; audit service stores before/after | Security + Backend | Create redaction/minimization policy before production/customer-visible expansion. |
| P1 | SEC-STORE-20260620-001 | `stores/create` allows any logged-in actor to create a store outside platform approval. | store repository creates store for logged-in actor | Product + Security | Owner decision: self-service store creation allowed or platform-admin-only. |
| P2 | SEC-STAFF-20260620-001 | Member roster/invitation listing is visible to any active store member. | `listStoreMembers` uses store context, not owner/manager role gate | Security + Product | Decide staff roster visibility by role. |
| P2 | SEC-ENV-20260620-001 | Local/no-Supabase-config and E2E bypass disable auth. | proxy/auth-context bypass code | Security + DevOps | Ensure production env cannot run without required Supabase auth config. |
| P2 | DATA-LEGACY-20260620-001 | Message settings repository keeps legacy default-store fallback compatibility paths. | `message-settings.repository.ts` patterns; service passes strict store id | Data + Backend | Keep service-level strict store context; review fallback before production data migration. |
| P2 | QA-PERM-20260620-001 | Permission matrix lacks dedicated automated tests for role-specific denied writes. | current scan/report | QA + Security | Add role denial test plan after Owner policy decision. |

## Approval Levels

| Decision/action | Recommended authority | Why |
|---|---|---|
| Continue source scans and write governance reports | L2 / D1 | Non-destructive, local, reversible. |
| Add tests documenting current permission behavior without changing behavior | L2 / D1-D2 | Low-risk if scoped, but still code changes. |
| Change server role gates for order/customer/payment/message mutations | D3 Owner approval | Could block staff workflows or alter shop operations. |
| Change store creation/onboarding policy | D3 Owner approval | Business-policy and tenant lifecycle impact. |
| Run live Supabase permission audit using service credentials | D3 explicit approval | Secret handling and production-adjacent access. |
| Apply migrations, alter RLS/grants, modify production roles/data | D4 explicit approval | Production/security/data impact. |
| Run `scripts/ensure-owner-admin.ts` against live Supabase | D4 explicit approval | Uses service role and admin password; changes users/roles/audit logs. |

## First L2 Follow-up Tasks

| Task | Title | Scope | Stop condition |
|---|---|---|---|
| L2-025 | Role-policy decision package | Produce a role/action proposal for Owner approval: viewer, sales, technician, manager, owner; no code changes. | Stop before implementing gates. |
| L2-026 | Permission denial test plan | Identify exact server/API tests needed for role denies and allowed paths. | Stop before changing auth behavior unless approved. |
| L2-027 | Audit-log redaction policy draft | Define which fields can enter audit `metadata`, `before_data`, `after_data`. | Stop before code changes. |
| L2-028 | Production Supabase permission audit plan | Prepare read-only checklist and exact commands/questions for Owner approval. | Stop before using live secrets or remote access. |
| L2-029 | Production env safety checklist | Verify required Supabase env expectations, E2E bypass boundaries, and deployment guardrails from local config/docs. | Stop before deployment changes. |

## Acceptance Matrix

| Acceptance criterion | Result | Evidence |
|---|---|---|
| Inventory auth, role, tenant, staff, platform-admin paths | met | `auth-context`, proxy, router, repositories, migrations scanned. |
| Map sensitive actions to controls/assumptions/unknowns/approval levels | met | Permission matrix and approval levels above. |
| Identify P0/P1/P2 permission, tenant, secret, production-readiness risks | met | Risk table above. |
| Produce report under task directory | met | This file. |
| Do not modify business/auth/database/secrets/production data | met | Only governance/memory files changed. |
| Run non-destructive validation | met | Targeted permission source scan completed; `npm run agents:check` passed. |
