# Independent Partner Store Platform Plan

Last updated: 2026-07-07
Owner: Hexiang Huang / 鹤祥
Status: Active planning source

## Purpose

RepairDesk should be planned as a privacy-first platform for independent partner stores, not as one company with branches and employees.

Each store is operated by an independent store owner. Each store owner must control their own customers, orders, payments, inventory, photos, staff, settings, and exports. Platform-level access exists to operate the system, onboard stores, handle billing/cooperation status, and provide support only under clearly defined privacy rules.

## Platform Relationship Declaration

The platform is not a headquarters. Stores are not platform branches, subsidiaries, or departments. The platform is a system service provider for independent store owners.

Each store is an independent operating entity and a private tenant. Store A and Store B must be treated as separate businesses even when they use the same RepairDesk application, database, schema, and migration path. Shared product logic must never imply shared business-data ownership.

Platform operators may manage the system, cooperation status, onboarding controls, abuse controls, billing/cooperation metadata, and owner-granted support controls. Platform operators must not receive default access to store customers, orders, payments, inventory, attachments, messages, settings, staff records, exports, or other business data.

## Product Positioning

RepairDesk is a multi-tenant repair-shop operating system.

The platform provides:

- Account registration and authentication.
- Store creation and ownership.
- Store-scoped repair orders, customers, inventory, payments, message templates, attachments, and settings.
- Store owner controlled member management.
- Platform-level cooperation, plan, support, and risk controls.

The platform must not behave like:

- A headquarters that owns every store's data.
- A parent company whose staff can freely administer independent stores as internal branches.
- A shared staff system where platform operators can freely browse store business records.
- A public directory of existing stores.

## Core Principles

1. Every store is a private tenant.
2. Store data belongs to that store owner.
3. Store owners see only their own store data.
4. Store staff see only what their store owner grants.
5. Other stores are never visible by default.
6. Platform operators do not get default business-data visibility.
7. Any platform support access to store business data must be explicit, time-limited, and audited.
8. Frontend hiding is never a permission boundary; service-side checks and database isolation are required.

## Tenant Model

### Platform Account

A login identity. A person can:

- Own one or more stores.
- Be invited into one or more stores.
- Request to join a store.
- Use only active store memberships.

### Store

A private tenant/workspace with:

- One or more owners.
- Store-specific settings.
- Store-specific customers, orders, inventory, templates, payments, attachments, and audit logs.
- Cooperation status with the platform.

### Membership

A relationship between an account and a store.

Memberships are store-scoped. A role in Store A does not imply any access to Store B.

## Recommended Architecture Direction

### Recommended Option: Shared Database With Strict Tenant Isolation

Use one shared Supabase/Postgres project for all stores, with strict store-level isolation in every table, service, cache key, and database policy.

This means:

- Shared control plane: accounts, stores, memberships, onboarding requests, cooperation status.
- Store-scoped business data: customers, devices, orders, inventory, attachments, payments, templates, audit logs.
- Strong `store_id` filtering in every server repository.
- Database constraints and RLS as defense in depth.
- One codebase and one schema path: functional logic and migrations apply to all stores.
- Store-specific differences are handled through `store_settings`, workflow settings, roles, and feature flags, not database forks or code forks.

### Alternatives

#### A. Shared Database, Strict Rows

Fastest and lowest cost.

Use when:

- The platform is early-stage.
- Store count is small to medium.
- Operational simplicity matters.

Risks:

- Bugs in service code could cause cross-store leakage if guardrails are incomplete.
- Requires strong test coverage and schema constraints.

#### B. Physical Database Per Store

Strongest isolation.

Use when:

- Stores demand contract-level physical data separation.
- There are high-value enterprise tenants.
- Backup/restore must be per-store and legally separated.

Risks:

- Higher cost.
- Harder migrations.
- More complex deployment, monitoring, backup, and support.

#### C. Hybrid / Dedicated Database Later

Not the active plan.

The owner clarified on 2026-07-07 that RepairDesk should stay on one shared database while ensuring complete tenant isolation. Do not plan one physical database per store unless the owner makes a separate future architecture decision.

## Platform Visibility Rules

### Platform Can See By Default

- Store id, name, owner account email, store status, plan/cooperation status.
- Store creation date and last active date.
- High-level health metadata, such as failed jobs or migration status.
- Support authorization status.
- Billing/cooperation fields, if later added.

### Platform Cannot See By Default

- Customers.
- Phone numbers.
- Devices and IMEI.
- Repair orders.
- Order notes and diagnosis.
- Payments and amounts.
- Attachments/photos.
- Message history.
- Inventory details.

### Platform Support Access

Platform support can access business data only when:

1. Store owner grants support access.
2. Access has an expiration time.
3. Access scope is explicit, such as orders only, settings only, or full read-only.
4. Every access is logged.
5. Store owner can review access history.

Default recommendation: support access is read-only first. Write support access should be a later, separately approved feature.

## Roles

| Role | Scope | Can Do |
|---|---|---|
| `platform_owner` | Platform | Manage system, plans, store lifecycle, support controls; no default store business-data access |
| `platform_support` | Platform | Assist stores only when support access is granted |
| `store_owner` | Store | Full control of one store's data, settings, exports, members, and support access |
| `store_manager` | Store | Manage daily operations and limited staff permissions if owner allows; cannot grant manager-level access by default |
| `store_staff` | Store | Work on assigned operational modules |
| `store_viewer` | Store | Read-only store access |

## Onboarding Flows

### Flow 1: Create Independent Store

1. User registers account.
2. User chooses "Create my store".
3. User enters store name, owner display name, country/timezone/currency, and contact email.
4. System creates store.
5. Creator becomes `store_owner`.
6. Store private workspace is initialized.

Business rules:

- A new store is not visible to other stores.
- Owner can invite members after store creation.
- Platform may optionally approve store creation if cooperation needs manual screening.

### Flow 2: Owner Invites Member

1. Store owner opens Settings > Members.
2. Owner enters member email and role.
3. System creates invitation.
4. Invitee registers or logs in.
5. Invitee verifies their email/account identity and accepts invitation.
6. Membership becomes active.

Business rules:

- This is the preferred flow for privacy and accuracy.
- Invitation should expire.
- Owner can revoke pending invitation.
- Manager-level invitations are owner-only by default.

### Flow 3: Invite Code / Invite Link

1. Store owner generates invite code or invite link.
2. Owner shares it privately.
3. New user enters code or opens link during registration.
4. System verifies account email and creates or returns a pending invitation only.
5. Membership becomes active only after the invitee accepts the invitation.

Business rules:

- Code must have expiration and optional use limit.
- Code can carry default role.
- Code should be rotatable.
- Public redemption response must not expose `store_id`, `invited_by`, `accepted_at`, or store business data.
- Raw invite code/token must never be stored in logs or listed back to users after creation.

### Flow 4: Applicant Requests Store Access

1. User chooses "Join existing store".
2. User enters owner email or invite code.
3. System does not list existing stores.
4. If owner email matches one store uniquely, request routes to that store owner.
5. If owner email matches multiple stores or no store, request goes to fallback review.
6. Store owner approves/rejects and selects final role.

Business rules:

- Applicant cannot request `store_owner`.
- Store owner can change requested role during approval.
- Applicant can cancel pending request.
- Rejected applicant can reapply after seeing the reason.
- Manager-level approval/grant is owner-only by default.

## Data Isolation Requirements

Every business table must be store-scoped unless explicitly platform-global.

Store-scoped examples:

- Customers.
- Devices.
- Repair orders.
- Order events.
- Payments.
- Inventory.
- Suppliers.
- Attachments.
- Store settings.
- Message templates.
- Audit logs.

Required invariants:

- All list APIs must filter by active store.
- All detail APIs must filter by both id and active store.
- All inserts must set active `store_id` server-side.
- Cross-table relations must preserve same-store constraints where possible.
- Search cannot return records from other stores.
- Export cannot include records from other stores.

## Security And Privacy Controls

Must have:

- Server-side authorization for every business route.
- Store membership validation before every store-scoped read/write.
- Verified-email gate before create-store, join request, invite redemption, and invitation acceptance.
- Owner-only manager-role grants and manager-level approvals unless the owner later approves a policy change.
- CSRF/Origin protection for unsafe cookie-authenticated mutations.
- Store-scoped query keys in frontend caches where relevant.
- Store-scoped storage paths for attachments/photos.
- Audit logs for member changes, support access, exports, role changes, and sensitive reads if support access is enabled.
- Tests for cross-store denial.

Should have:

- Owner-visible support access log.
- Time-limited support access grants.
- Store-level data export.
- Store-level data deletion/closure workflow.
- Rate limits for onboarding requests and invite-code attempts.
- Rate limits for create-store attempts, owner-email request attempts, and cancel/reapply loops.

## Platform Support Access State Machine

```text
disabled
  -> requested_by_platform
  -> granted_by_owner
  -> active
  -> expired
  -> revoked_by_owner
```

Rules:

- Owner can revoke at any time.
- Platform cannot self-grant business access.
- Expired access cannot be used.
- Every access attempt must be audited.

## Onboarding Request State Machine

```text
draft
  -> submitted
  -> routed_to_store
  -> needs_platform_review
  -> approved
  -> rejected
  -> cancelled
  -> expired
```

Rules:

- A user cannot have duplicate pending requests for the same store.
- Owner approval creates/activates membership.
- Rejection must store a reason.
- Cancellation is user-initiated.
- Expiration should be automatic after a configurable time.
- Applicant-facing responses must not reveal whether a store, owner email, invite, or link exists.

## Roadmap

### Phase 0: Documentation And Direction Lock

Status: completed

Deliverables:

- This plan document.
- Progress and decision log.
- Project memory pointer.
- Owner choices captured.

Exit criteria:

- Owner selects data isolation, onboarding, and platform visibility defaults.

### Phase 1: Privacy-First Store Ownership Baseline

Status: in progress. SG0-SG6 passed; SG7 closeout is active.

Goal: make the current implementation match independent store ownership semantics.

Work:

- Rename product language away from "enterprise branch/staff" where confusing.
- Make store owner the primary approval actor.
- Keep manager-level access grants owner-only by default.
- Keep platform fallback but remove platform as default business-data owner.
- Add owner-controlled member invitation as primary flow.
- Add applicant cancellation and rejection reason visibility.
- Let owner adjust role during approval.

Exit criteria:

- A new independent owner can create a store.
- A member can join only by invitation, code, or owner-approved request.
- No store list is exposed.

### Phase 2: Tenant Isolation Audit And Hardening

Goal: prove store-private data boundaries.

Current status: conditional local pass on 2026-07-04. Safe local hardening and tests were completed under `TASK-20260705-001-tenant-isolation-audit`; production parity remains approval-gated.

Work:

- Audit all business APIs for `store_id` filtering.
- Audit all detail routes for object-level store authorization.
- Audit storage paths for store scoping.
- Add/repair tests for cross-store denial.
- Add missing indexes and constraints.
- Review platform admin routes for business-data visibility.

Exit criteria:

- Cross-store read/write tests pass for major domains.
- Platform routes show only allowed metadata by default.

Production parity still requires owner-approved Supabase schema/RLS/storage verification, role-policy approval, and release/rollback runbook before live rollout claims.

### Phase 3: Support Access And Audit

Goal: allow safe platform support without silent data access.

Work:

- Add store owner support-access grant UI.
- Add support-access scopes and expiration.
- Add support access audit log.
- Add platform support mode indicator.

Exit criteria:

- Platform support cannot access business data without active grant.
- Store owner can see who accessed what and when.

### Phase 4: Store Lifecycle And Cooperation Management

Goal: support real partner-store operations.

Work:

- Store status: active, suspended, cancelled, archived.
- Cooperation plan/status.
- Owner transfer process.
- Store export.
- Store closure and retention policy.

Exit criteria:

- Platform can manage cooperation without reading private business data.
- Store owner can safely leave/export/close.

### Phase 5: Unified Feature Rollout Controls

Goal: keep one shared codebase and schema while allowing controlled rollout where needed.

Work:

- Define feature flags or store settings for staged rollout.
- Keep protected feature checks server-side.
- Document which features are global and which settings are per-store.
- Verify migrations and logic changes apply to all stores consistently.

Exit criteria:

- A new capability can be released globally without per-store code forks.
- A high-risk capability can be disabled for selected stores without weakening data isolation.

## Decision Points For Owner

Decision status: revised by owner on 2026-07-07.

### D1: Default Data Isolation

Confirmed: Shared database with strict `store_id` isolation.

Options:

- A: Shared database, strict `store_id`. Current decision.
- B: Physical database per store.
- C: Hybrid: shared first, dedicated DB possible later. Not active.

### D2: Joining A Store

Confirmed: keep all three, but make owner invitation primary.

Options:

- A: Owner invitation only.
- B: Owner email request.
- C: Invite code/link.
- D: All three.

### D3: Platform Business Data Visibility

Confirmed: support access only after owner grant.

Options:

- A: Platform can never view business data.
- B: Platform can view only with time-limited owner authorization.
- C: Platform admin can view anytime, fully audited.

### D4: Store Creation Review

Confirmed: self-serve create first; platform can suspend abusive stores later.

Options:

- A: New owner creates store instantly.
- B: Platform must approve every new store.
- C: Instant trial store, platform approval required for activation/payment features.

## Acceptance Criteria For Future Implementation

- Given two stores with separate owners, when Owner A searches orders, then no Store B order appears.
- Given platform owner opens platform dashboard, when no support grant exists, then customer/order/payment/photo data is not returned.
- Given store owner grants support access for 1 hour, when platform support opens the store within that hour, then access is allowed and audited.
- Given support access expires, when platform support retries, then access is denied.
- Given applicant joins by owner email, when the email maps to multiple stores, then no store is exposed and fallback review is required.
- Given owner approves a request, when selecting final role, then membership is created with that final role.
- Given a manager tries to grant manager-level access, then the request is denied unless a later owner-approved permission change allows it.
- Given an unverified account tries to create or join a store, then onboarding mutation is denied.
- Given a cross-origin site sends a cookie-authenticated mutation, then the API denies it.
- Given owner rejects a request, when applicant checks status, then rejection reason is visible.

## Update Rules

This document is the long-term planning source for independent partner store architecture and product direction.

Update this document when:

- The owner makes a direction choice.
- A phase starts or closes.
- A role, permission, or privacy rule changes.
- A database isolation decision changes.
- A support-access policy changes.

Progress updates belong in:

- `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`

Implementation evidence belongs in:

- `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/`
