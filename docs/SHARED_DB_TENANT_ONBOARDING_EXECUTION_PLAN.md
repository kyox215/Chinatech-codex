# Shared Database Tenant Onboarding Execution Plan

Last updated: 2026-07-09
Owner: Hexiang Huang / 鹤祥
Status: Active execution plan; Phase 1 through Phase 4 completed locally; Phase 5 read-only CLI preflight is blocked on migration-history mismatch before full live SQL verification; production migration/apply/release remains blocked until Phase 5R reconciliation is resolved
Scope: Registration, onboarding, store creation, store joining, and same-database tenant isolation

## Decision

RepairDesk will use one shared Supabase/Postgres database for all stores.

This replaces any plan that assumes one physical database per store or a near-term dedicated-database path. Store privacy is enforced by tenant boundaries inside the shared database, not by separate database projects.

Core rule:

```text
One database and one codebase.
All stores receive the same application logic and schema migrations.
Each store's business data remains private through strict store_id isolation, service-side authorization, database constraints, and RLS defense in depth.
```

## Database Application Gate

The shared-database decision does not mean every local migration can be pushed automatically.

Before any linked Supabase apply, all of the following must be true:

1. Phase 5R migration-history reconciliation is resolved, or every remaining mismatch has an owner-approved exception.
2. No unresolved remote-only migration versions remain without an exact SQL file, reviewed reconstruction, or approved remediation.
3. Every local-only migration is classified as intended pending, represented remotely, stale, or draft-excluded.
4. `supabase migration list --linked` and `supabase db push --linked --dry-run` produce an expected pending set with no surprise destructive change.
5. Backup location, restore proof, operator, maintenance window, target Supabase project, rollback/forward-fix plan, and redaction reviewer are recorded.
6. DATA, SECURITY, QA, and RELEASE reviews are complete.
7. The owner approves the exact command set for the target environment.
8. Post-apply verification queries and schema-cache verification are prepared before apply.

Current apply status on 2026-07-09:

- Supabase CLI is available locally.
- Linked production apply is still blocked by migration-history reconciliation evidence in `docs/SHARED_DB_TENANT_PHASE5R_MIGRATION_RECONCILIATION_PLAN.md`.
- Do not run `supabase db push`, `supabase migration repair`, schema-cache reload, or production data mutation from ordinary feature tasks.

## Goals

1. A newly registered user can immediately choose a store path.
2. Creating a new store immediately opens a private store workspace in the shared database.
3. Joining an existing store never exposes a public store list.
4. Store data is isolated so one store cannot read, search, mutate, export, or infer another store's business data.
5. Feature changes, bug fixes, schema migrations, and business logic updates apply consistently to every store.

## Non-Goals

- Do not create one database per store.
- Do not create per-store forks of the application code.
- Do not let platform admins browse store business data by default.
- Do not expose existing store names during registration.
- Do not implement production migrations or deployment from this planning phase.

## Product Flow

### Entry

```text
/login
  -> user registers account
  -> if Supabase requires email confirmation, user confirms and logs in
  -> if user has no active store, route to /onboarding
  -> /onboarding shows two primary choices
```

### Choice A: Create New Store

```text
Registered account
  -> Create New Store
  -> Enter store name, country, timezone, currency
  -> Server verifies account email is confirmed/verified
  -> Server creates stores row
  -> Server creates active owner membership
  -> Server initializes store defaults
  -> Server sets active store context
  -> User enters workspace
```

Required behavior:

- The new store is private from creation.
- Creator becomes `owner`.
- Store creation does not require platform approval.
- Store creation requires a verified email/account identity before opening a tenant.
- Store creation must be idempotent enough to handle double click, refresh, and stale retry.
- If default initialization fails, the system must not leave an active half-configured store without a recoverable status.
- Target hardening path is a transaction/RPC-style operation that creates the store, owner membership, store settings, workflow statuses/transitions, message templates, and audit metadata as one recoverable unit.

### Choice B: Join Existing Store

```text
Registered account
  -> Join Existing Store
  -> Use owner email, invite code, or invite link
  -> Server verifies account email is confirmed/verified
  -> System creates pending request or pending invitation
  -> Store owner approves or invitee accepts
  -> Membership becomes active
  -> User enters that store
```

Required behavior:

- Existing stores are not listed.
- Public responses must not reveal whether an owner email exists, which store it owns, or how many stores match.
- Applicant cannot request or receive `owner` role through join paths.
- Store owner controls approval, rejection, revocation, and invitations inside Settings.
- Manager-level access must be granted only by an owner. Managers must not be able to grant another manager role unless a later owner-approved permission change explicitly allows it.

### Product State Priority

When a logged-in user without an active store opens onboarding, the page should resolve in this priority order:

1. Active store exists: show entry action and route to workspace.
2. Pending invitation exists: show accept invitation first.
3. Pending join request exists: show pending status and cancel action.
4. Latest rejected/cancelled request exists: show reason and allow resubmit.
5. No active state: show the two primary choices, Create New Store and Join Existing Store.

## Account And Store States

| State | Meaning | Allowed routes |
|---|---|---|
| `logged_out` | No auth session | `/login` |
| `registered_no_store` | Logged in but no active store | `/onboarding`, setup APIs |
| `creating_store` | Create-store request in progress | `/onboarding` |
| `active_store_owner` | Created store and owner membership | app workspace |
| `join_pending` | Join request waiting for review | `/onboarding` |
| `invited_pending_accept` | Invitation exists but not accepted | `/onboarding` |
| `active_store_member` | Active membership exists | app workspace |
| `platform_admin_only` | Platform admin without active store | `/platform`, no store business access by default |
| `suspended` | Store or membership disabled | limited support/status page |

## Shared Database Isolation Model

### Control Plane Tables

Control plane tables manage identity and access:

- `staff_profiles`
- `platform_admins`
- `stores`
- `store_memberships`
- `store_invitations`
- `store_invite_links`
- `store_invite_link_attempts`
- `onboarding_requests`
- `platform_audit_logs`

Open data-model requirement:

- Each active store should have at least one active owner membership. Existing uniqueness prevents duplicate memberships, but "at least one active owner" needs service checks, validation queries, or a database-maintained invariant before claiming production-grade lifecycle safety.

### Store-Scoped Business Tables

Every business table must be store-scoped unless explicitly documented as platform-global.

Examples:

- `customers`
- `devices`
- `customer_interactions`
- `repair_orders`
- `order_events`
- `order_attachments`
- `inventory_items`
- `inventory_transactions`
- `inventory_attachments`
- `suppliers`
- `store_settings`
- `message_templates`
- `order_workflow_statuses`
- `order_workflow_transitions`

Payment data is currently stored on `repair_orders` through amount and `payment_status` fields rather than a standalone `payments` table, so Phase 5 verifies payment isolation through `repair_orders` until a separate payments ledger exists.

## Isolation Invariants

These are non-negotiable rules for implementation.

1. Store-scoped tables must have `store_id`.
2. Store-scoped `store_id` must be `not null` after safe backfill.
3. List queries must filter by actor active store.
4. Detail queries must filter by both object id and `store_id`.
5. Inserts must set `store_id` on the server from actor context.
6. Updates and deletes must include `store_id` predicates.
7. Cross-table relationships must preserve same-store constraints.
8. Search cannot return records from other stores.
9. Exports cannot include records from other stores.
10. Platform admin status alone does not grant store business access.
11. RLS is defense in depth; service code must still enforce isolation.
12. Cache/query keys must include active store where business data can differ.

## Security Release Gates

These controls are required before a production rollout of onboarding/store-join changes:

1. Verified-email gate: unverified accounts cannot create stores, submit join requests, redeem invite codes/links, or accept invitations.
2. Owner-only high-permission grant: manager grants and manager approvals require owner authority; the permission matrix and repository checks must match.
3. CSRF/Origin protection: unsafe cookie-authenticated API mutations must reject cross-origin or untrusted browser requests.
4. Onboarding abuse limits: create-store, owner-email join requests, invite redemption, cancel/reapply loops, and target-owner-email attempts need server-side throttling.
5. Generic external errors: requester-facing responses must not leak whether a store, owner email, invitation, or link exists.
6. Audit hygiene: invite/link attempts may record actor email hash, IP hash, code hash, and result, but never raw codes/tokens or unnecessary PII.

## Function Sync Model

All stores share the same application code and schema.

Global updates:

- New order logic applies to all stores.
- New customer fields apply to all stores.
- Bug fixes apply to all stores.
- Database migrations apply once to the shared database.

Store-specific differences:

- Store settings.
- Store workflow configuration.
- Store message templates.
- Store roles and permissions.
- Feature flags when a capability needs staged rollout.

No per-store code fork is allowed.

## Phase Plan

### Phase 0: Plan And Decision Lock

Status: completed locally.

Deliverables:

- This execution plan.
- Progress log entry replacing dedicated-database assumptions.
- Task memory for ongoing staged execution.
- Read-only product/data/security sub-agent review.

Exit criteria:

- Plan records shared-database decision.
- Sub-agent objections are integrated or explicitly deferred.
- No runtime behavior is changed.

### Phase 1: Registration And Onboarding UX Contract

Status: completed locally for server-side release blockers; UI copy/state refinements remain allowed follow-up work.

Goal:

Make the user path obvious immediately after registration.

Work:

- Register -> `/onboarding`.
- `/onboarding` first screen has two clear primary actions: create new store, join existing store.
- Keep invite code and owner-email join paths.
- Show current state: pending request, pending invitation, rejected request, active store.
- Add or refine copy so "create store" means creating a private workspace in the same database.

Files likely affected:

- `src/features/auth/screens/login-screen.tsx`
- `src/features/auth/screens/onboarding-screen.tsx`
- `src/features/auth/model/onboarding-flow.ts`
- `src/features/auth/model/post-login-redirect.ts`
- `src/features/auth/screens/onboarding-screen.test.tsx`

Validation:

- Register redirects to onboarding when no active store.
- Unverified email/account is blocked from create-store, join request, invite redemption, and invite acceptance.
- Create-store button calls `stores/create`.
- Join-store form never lists stores.
- Pending/rejected/invited states are understandable on mobile.

Product decisions to resolve in this phase:

- Whether a pending join request blocks self-serve create-store, or whether the user may cancel the request and create a store.
- How platform fallback requests are resolved when owner email matches zero or multiple stores. Platform must not approve private-store membership directly, so the fallback path needs either rejection with guidance, owner invite/code fallback, or a separate manual-routing procedure.

Completed Phase 1 implementation:

- Verified-email gate now blocks create-store, join request, invite redemption, and invitation acceptance.
- Unsafe `/api/repairdesk` POST requests now reject cross-origin browser requests and non-JSON mutation payloads.
- Manager-level grants are owner-only through the permission matrix.
- Create-store and owner-email join requests have no-migration soft throttles.

Completed validation:

- `npm run lint`
- `npm run typecheck`
- Targeted Vitest for route guard, router, store repository, platform repository, and permission matrix.
- Full `npm run test`
- `npm run build` passed outside sandbox; first sandbox attempt failed on Turbopack port binding permission only.

Deferred Phase 1 residuals:

- Soft throttles are not a substitute for durable database-backed limits.
- CSRF protection is currently browser-header based; token-backed protection remains a later hardening option.
- Invite/link attempt audit minimization and retention require a later schema/data policy change.

### Phase 2: Store Creation Hardening

Status: completed locally with durable idempotency and transactionality deferred to database/RPC phase.

Goal:

Make create-store safe, repeatable, and private.

Work:

- Store creation service creates store, owner membership, defaults, and active context.
- Require verified email/account identity before tenant provisioning.
- Initialize defaults for `store_settings`, order workflow statuses/transitions, message templates, and any required numbering/settings rows.
- Add idempotency or duplicate-submit guard.
- Add create-store rate limits by actor and request origin/IP hash.
- Prefer atomic RPC/transaction-style provisioning; if not possible in the first code slice, add explicit initialization status and recovery checks.
- Ensure owner membership failure rolls back or marks store unavailable.
- Audit `create_store` with minimized payload.

Files likely affected:

- `src/features/stores/server/store.repository.ts`
- `src/features/stores/server/store.repository.test.ts`
- `src/features/stores/testing/mock-api.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-router.test.ts`

Validation:

- Double create submission does not create two accidental stores.
- Failed owner membership does not expose a half-created active store.
- Creator becomes owner only for the new store.

Required edge-case proof:

- Double click, retry, refresh, or parallel create-store submissions cannot accidentally create duplicate active stores for the same intended setup.
- Store creation failure leaves no active half-configured store, or leaves a clearly recoverable non-active provisioning state.

Completed Phase 2 implementation:

- Added application-layer store provisioning helper.
- New store rows are created as `suspended`, then activated only after defaults and owner membership succeed.
- Defaults now include store settings, message templates, order workflow statuses, and order workflow transitions.
- Workflow defaults are explicit server seed data aligned with current migration fixes.
- Failure paths delete provisioned defaults before deleting the store.
- User-facing create-store failure messages are generic and do not expose raw database errors.

Completed validation:

- `npm run lint`
- `npm run typecheck`
- Targeted store repository test suite: 34 tests.
- Targeted guard/router/store/platform/permissions suite: 5 files / 70 tests.
- Full `npm run test`: 76 files / 501 tests.
- `git diff --check` for current task files.

Deferred Phase 2 residuals:

- Durable duplicate-submit idempotency requires a database-backed request key or RPC.
- Full atomicity requires transaction/RPC provisioning.
- Build rerun was blocked by an unrelated active `npm run test:e2e:desktop` / `next start -p 3011` process.

### Phase 3: Join Store Privacy Hardening

Status: completed locally; security re-review PASS; QA re-review CONDITIONAL without blocker; production release still depends on Phase 4/5 isolation audit and database/RLS work.

Goal:

Keep join mechanisms private and owner-controlled.

Work:

- Owner-email request does not enumerate stores.
- Invite code/link returns pending invitation only.
- Invitation acceptance requires matching logged-in verified email and unexpired invite.
- Owner approval cannot grant `owner`.
- Manager approval/grant of manager-level access is denied unless a later owner-approved permission change explicitly allows it.
- Settings shows incoming join requests clearly.
- Store owner approval UI lets the reviewer choose the final non-owner role before approval; server remains the source of truth and still blocks `owner`.
- Invite code claim plus pending invitation creation should become atomic or have compensation/retry semantics so a failed invitation insert does not consume invite usage permanently.
- Add abuse controls for owner-email request spam, invite-code redemption, and cancel/reapply loops.

Files likely affected:

- `src/features/platform/server/platform.repository.ts`
- `src/features/stores/server/store.repository.ts`
- `src/features/platform/model/onboarding-review-policy.ts`
- `src/features/settings/screens/settings-screen.tsx`
- `src/server/api/repairdesk-schemas.ts`

Validation:

- Zero-match, one-match, and multi-match owner-email responses are externally indistinguishable.
- Public invite redemption does not expose `store_id`, `invited_by`, or business data.
- Wrong email cannot accept invitation.
- Unverified email cannot accept invitation even when the email string matches.
- Manager cannot invite or approve another manager; owner can where policy allows.

Known product gap:

- Resolved locally: Settings now lets an owner choose the final non-owner role before approving a join request.

Completed Phase 3 implementation:

- `getOnboardingStatus` no longer reads email-bound store invitations until the actor email is verified.
- Owner-email join responses still redact target store id/name and do not expose match count.
- Requester-facing join request views redact reviewer internal ids.
- Store access request list/approve/reject is now owner-only; managers cannot process join requests.
- Settings join-request cards include a final approved-role selector and send `approved_role` to the server.
- The onboarding copy now avoids promising that a possibly unmatched owner email reached an owner queue.
- API schema rejects requester-supplied `target_store_id` on join requests even when owner email is present.
- Owner-email lookup and approval side-effect failures use generic public errors.
- Invite-link attempt writes no longer store raw `actor_email`.

Completed validation:

- `npm run lint`
- `npm run typecheck`
- Targeted Phase 3 suite: 5 files / 75 tests.
- Full `npm run test`: 76 files / 510 tests.
- `npm run build` passed outside sandbox; the sandbox attempt failed only because Turbopack could not bind a port in the sandbox.

Deferred Phase 3 residuals:

- Settings approval role selector needs a browser/component interaction test before production release.
- DB-level protection or proof for direct writes that combine `target_owner_email` and `target_store_id` belongs to Phase 5.
- Zero/multiple owner-email fallback still needs a product decision for stale pending platform-scoped requests.
- Invite-code claim plus pending invitation creation still needs database/RPC transactionality or stronger compensation.
- Invite attempt table still contains an existing `actor_email` column; production retention/backfill/removal belongs to Phase 5.
- Full generic error mapping for every low-level invite/onboarding DB failure remains a Phase 4/5 hardening task.

### Phase 4: Tenant Isolation Audit And Guardrails

Status: completed locally; full production isolation still depends on Phase 5 live database/RLS/storage verification.

Goal:

Prove active store boundaries across all business domains.

Work:

- Audit all server repositories for `store_id` list/detail/write predicates.
- Audit all query keys for active-store scoping.
- Add Origin/Sec-Fetch-Site or CSRF token protection for unsafe cookie-authenticated mutation routes.
- Add denial tests for cross-store detail access.
- Add object ownership checks for customer/order/device/inventory relations.
- Inventory storage and attachment paths must be store-scoped.
- Identify and remove or prove unreachable any legacy default-store fallback write path before claiming full isolation.

Files likely affected:

- `src/features/orders/server/*`
- `src/features/customers/server/*`
- `src/features/inventory/server/*`
- `src/features/messages/server/*`
- `src/server/auth-context.ts`
- `src/server/permissions.ts`
- `src/server/tenant-guard.test.ts`
- feature query key files

Validation:

- Store A cannot list/search/detail/update Store B objects.
- Platform admin without support grant cannot read store business data.
- Cache does not show previous store data after switching stores.
- Service-role repository paths have explicit cross-store denial tests because service role bypasses RLS.
- Cross-origin POSTs to onboarding/store/member mutations are rejected.

Implemented locally:

- Removed fail-open schema-drift fallbacks from customer child data and message settings/templates so missing `store_id` now fails closed instead of running unscoped queries.
- Added production source-mode guard: production runtime requires Supabase service/browser auth configuration and rejects E2E bypass or mock fallback.
- Centralized store-switch cache clearing in `clearTenantScopedQueryCache` / `applySwitchedStoreContext`.
- Hardened order and inventory attachment signed URL generation with fixed bucket plus `${storeId}/${objectId}/` path-prefix checks; invalid metadata loses both signed and public URL trust.
- Removed raw `storeId` authority from `transitionOrder`; transitions derive store context from the actor.
- Added focused regression tests for source mode, message fail-closed behavior, customer child fail-closed behavior, attachment path guards, transition actor context, and cache switch clearing.

Residual risks deferred to Phase 5:

- Live Supabase schema/RLS/storage parity must be verified before claiming production-grade tenant isolation.
- Database-level attachment path constraints and storage policies need linked-project validation.
- Existing production rows with null/default `store_id` must be audited with validation queries before migration apply.

### Phase 5: Database Constraints And RLS Defense

Status: owner-approved read-only CLI preflight ran and blocked on migration-history mismatch; full live SQL query pack has not run; linked production apply is blocked until Phase 5R reconciliation passes. Detailed verification materials live at `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md`, `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md`, `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md`, `docs/SHARED_DB_TENANT_PHASE5R_MIGRATION_RECONCILIATION_PLAN.md`, and `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md`.

Goal:

Move isolation from code convention to database-backed defense.

Work:

- Verify every business table has `store_id`.
- Add missing `(id, store_id)` unique indexes for composite references.
- Add same-store foreign keys where supported.
- Add or verify RLS policies on exposed tables.
- Add preflight queries and rollback notes before production apply.
- Define retention/cleanup for invite-link attempt records containing actor email, code hash, IP hash, and result.
- Verify private attachment storage buckets, metadata public URL absence, storage object path prefixes, and PostgREST schema-cache visibility.
- Verify public grants, `security definer` functions, public views, active-store owner invariant, and onboarding direct-write constraints.
- Exclude offline-sync draft migrations from Phase 5 unless the Owner separately approves that scope.
- Use the approval packet to record target environment, operator, backup/restore proof, offline-draft exclusion, and `actor_email` retention decision before any live or linked Supabase command.
- Use the query pack index to run checks in a stable order and record redacted evidence.
- Reconcile remote-only migration history before continuing to the full live SQL query pack.

Validation:

- Migration text is additive first.
- No destructive migration without owner approval.
- Production application requires backup/restore and post-apply verification.
- "Fully isolated" cannot be claimed until live Supabase schema/RLS/storage parity is verified, not just local migration text.
- Current release status: full live SQL verification is no-go until migration history is reconciled or every mismatch has an Owner-approved remediation plan. Production migration, schema-cache reload, Vercel promote, and Phase 6 global rollout are no-go until the runbook gates pass.
- A local migration file or local test may be marked "implemented locally", but not "applied to production" unless the release evidence records the exact linked command, output summary, post-apply verification, and observation result.

### Phase 6: Unified Feature Rollout Controls

Status: not started; blocked until Phase 5 live verification or an Owner-approved remediation plan completes.

Goal:

Ensure feature changes sync to all stores while allowing controlled rollout.

Work:

- Define `feature_flags` or store settings for staged release only.
- Document that code and migrations are global.
- Add tests showing disabled feature blocks UI/API but does not fork code.

Validation:

- A new global feature has one implementation path.
- Feature flag is checked server-side for protected operations.
- New risky capabilities default off, can be killed globally, and have an owner-visible audit trail.

## Acceptance Matrix

| Requirement | Evidence |
|---|---|
| Create store does not require platform approval | onboarding/service tests |
| Store data is private | cross-store denial tests |
| No public store list | onboarding UI and API tests |
| Owner email request avoids enumeration | response-shape tests |
| Join cannot grant owner | schema/repository tests |
| Store switch clears cached business data | query cache tests/manual role test |
| Feature changes apply globally | docs plus shared implementation path |
| Platform cannot read business data by default | permission tests |
| Verified email is required for onboarding mutations | auth-context and route/repository tests |
| Manager cannot grant manager-level access | permission and repository tests |
| Unsafe API mutations reject cross-origin requests | API route tests |
| Onboarding abuse is rate-limited | create/join/invite throttling tests |
| Store owner can choose final non-owner role on approval | settings UI and repository tests |
| Create-store duplicate submission is safe | idempotency/race tests |
| Create-store provisioning is atomic or recoverable | RPC/transaction tests or recovery-state tests |
| Legacy default-store fallback is removed or unreachable | repository audit and denial tests |

## Stop Conditions

Pause and ask the Owner before:

- Applying production migrations.
- Changing live Supabase RLS policies.
- Making platform support access to business data.
- Deleting or backfilling production records.
- Deploying a high-risk auth/permission change.
- Releasing onboarding without verified-email, owner-only high-permission grants, CSRF/Origin checks, and abuse throttles.
- Introducing a new paid external service.

## Sub-Agent Review Plan

Active read-only agents for Phase 0:

- FLOW / Product Workflow: registration and onboarding states.
- DATA / Data Design: shared DB invariants, migration order, cross-store tests.
- SEC / Security Privacy: threat model, enumeration, privilege escalation, audit.

Integration Lead owns final plan, final implementation, and final verification.

## Open Decisions From Phase 0 Review

| Decision | Recommendation | Status |
|---|---|---|
| Owner-email fallback when zero/multiple stores match | Do not let platform approve private-store joins. Show generic pending/rejected guidance and steer applicant to owner invite/code. | pending integration |
| Pending join request vs create-store | Prefer explicit cancel-before-create so user intent stays clear and audit history is clean. | pending implementation |
| Final role during approval | Add owner-facing role selector; default to requested role but allow downgrade/adjustment among non-owner roles. | completed locally |
| Create-store duplicate safety | Add server-side idempotency/duplicate guard; UI disabled state alone is not sufficient. | soft guard completed; durable idempotency deferred |
| Create-store provisioning scope | Initialize store, owner membership, settings, workflow, templates, and audit in one recoverable operation. | recoverable app-layer provisioning completed |
| Invite-code atomicity | Combine claim and pending invitation creation or add compensation/retry semantics. | pending implementation |
| Live RLS/storage parity | Verify against production Supabase before claiming full tenant isolation. | approval-gated |
| Verified-email gate | Require verified account identity before create-store, join request, invite redemption, invite acceptance, and invitation visibility. | completed locally |
| Manager high-permission grant | Enforce owner-only manager grants and align repository checks with `src/server/permissions.ts`. | completed locally |
| CSRF/Origin gate | Add API-level protection for unsafe cookie-authenticated mutations. | completed locally with browser-header guard |
| Onboarding abuse limits | Rate-limit create-store, owner-email request, invite redemption, and cancel/reapply loops. | soft guards completed; durable limits deferred |
