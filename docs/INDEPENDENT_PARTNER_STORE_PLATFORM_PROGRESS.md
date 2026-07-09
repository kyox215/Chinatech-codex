# Independent Partner Store Platform Progress

Last updated: 2026-07-09
Linked plan: `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`
Phase 1 execution plan: `docs/INDEPENDENT_PARTNER_STORE_PHASE1_EXECUTION_PLAN.md`
Current task: `TASK-20260707-001-shared-db-tenant-onboarding`. Active plan: `docs/SHARED_DB_TENANT_ONBOARDING_EXECUTION_PLAN.md`.

## Current Direction

RepairDesk is being reframed as a privacy-first platform for independent partner store owners.

This replaces the earlier mental model of a single company with multiple branches and employees.

## Approved Product Decisions

Owner confirmed the recommended direction on 2026-07-04:

- Data isolation: one shared database with strict `store_id` tenant isolation. Dedicated database per store is not the active plan.
- Store joining: support owner invitation, invite code/link, and owner-email request.
- Platform visibility: platform cannot view business data unless the store owner grants time-limited support access.
- Store creation: self-serve store creation, with platform-level suspension/abuse controls later.

## Phase Tracker

| Phase | Status | Owner Decision Needed | Notes |
|---|---|---|---|
| Phase 0: Direction and documents | Completed | No | Plan/progress docs created; D1-D4 confirmed |
| Phase 1: Store ownership baseline | Completed locally | No | SG0-SG7 passed; not a production release approval |
| Phase 2: Tenant isolation audit | Conditional local pass | No for local audit; yes before production parity | Safe hardening applied; production RLS/storage parity still gated |
| Phase 2.1: Pre-production isolation hardening | Completed locally | Yes before role-policy runtime enforcement | Store-scoped client cache keys and behavior-level customer denial tests; no production changes |
| Phase 2.2: Role-policy approval package | Completed locally | Yes before runtime enforcement | Store role matrix, decision defaults, server-first enforcement plan, and production preflight drafted |
| Phase 2.3: Phase B1 server permission module | Completed locally | Yes before route gates | Server-only permission matrix and tests added |
| Phase 2.4: Role permission runtime gates | In progress | No; owner requested execution, main push, and database application | Server route gates, supplier permission-grant migration, and execution plan; field-level response projection remains Phase D |
| Phase 3: Support access and audit | Not started | Yes | Define platform support access scope and duration |
| Phase 4: Store lifecycle/cooperation | Not started | Yes | Plans, suspension, export, owner transfer |
| Phase 5: Unified feature rollout controls | Not started | Yes before enabling high-risk feature flags | One codebase/schema for all stores; store differences through settings/feature flags |

## 2026-07-07 Decision Update: Shared Database Only

Status: Approved by owner.

Decision:

- RepairDesk will use one shared database for all stores.
- Store privacy must be enforced through `store_id`, service-side authorization, same-store constraints, RLS defense in depth, scoped cache keys, and cross-store denial tests.
- Feature logic and schema migrations must apply to all stores through one codebase and one migration path.
- Do not plan one physical database per store unless the owner makes a separate future decision.

Reason:

- The owner wants complete isolation but also wants any store-level function or logic improvement to synchronize to all stores.
- A shared database with strict tenant isolation is simpler to operate and keeps product behavior consistent across partner stores.

Impact:

- Existing "hybrid / dedicated DB later" wording is superseded.
- New work should target `docs/SHARED_DB_TENANT_ONBOARDING_EXECUTION_PLAN.md`.
- Future per-store differences belong in settings, workflow configuration, roles, or feature flags, not code/database forks.

Phase 0 review result:

- Product review completed: onboarding must resolve active store, pending invitation, pending request, latest decision, then create/join choice in that order.
- Data review completed: create-store should become atomic or recoverable, every active store needs at least one active owner, and live RLS/storage parity remains approval-gated.
- Security review completed: verified-email enforcement, owner-only manager grants, CSRF/Origin protection, and onboarding abuse limits are release blockers before production rollout.
- Next implementation phase should start with the onboarding/auth contract, not database or production migration changes.

Phase 1 release gates added:

- Unverified accounts cannot create stores, submit join requests, redeem invite codes/links, or accept invitations.
- Managers cannot grant manager-level access or approve manager-level access unless a later owner-approved policy change allows it.
- Unsafe cookie-authenticated onboarding/member/store mutations must reject cross-origin requests.
- Create-store, owner-email request, invite redemption, and cancel/reapply loops must be rate-limited.

## Decision Log

### 2026-07-09: Role permission runtime enforcement started

Status: In progress.

Decision:

- Use `docs/ROLE_PERMISSION_CONFIGURATION_PLAN.md` as the active role-permission plan.
- Keep the server permission matrix as the authority for role/action decisions.
- Apply route-level enforcement first for high-risk writes and notifications.
- Apply the existing `store_member_permission_grants` migration after linked dry-run confirms scope.
- Treat order/customer read-response projection and sensitive field redaction as Phase D follow-up, not part of the current push, to avoid broad UI/API regressions in the same release.

Reason:

- The owner requested execution, main push, and database application after reviewing the need for technician/frontdesk role boundaries.
- Critical write actions can be closed with small, testable server-side gates.
- Field-level read projection touches many order/customer screens and needs a dedicated test matrix.

Impact:

- Batch order transitions are separated from normal single-order transitions.
- Customer-facing order notifications and approval requests must pass customer-message permission.
- Supplier permission grants remain owner-controlled and audited through the database-backed grant table.

### 2026-07-04: Reframe multi-store direction

Status: Draft, owner requested re-planning.

Decision:

- Treat each store as an independent tenant with its own owner.
- Store data must be private to that store owner and authorized store members.
- Platform is a system/cooperation/support layer, not the default business-data owner.

Reason:

- The owner clarified this is not a large-company-and-employees model.
- The intended business model is multiple cooperating independent stores.

Impact:

- Product language should move away from "enterprise branch" where it implies central company ownership.
- Platform admin routes must be reviewed so they do not expose private store business data by default.
- Onboarding should prioritize owner invitation and private join mechanisms.

### 2026-07-04: Owner confirmed recommended D1-D4 baseline

Status: Superseded in part by the 2026-07-07 shared-database-only decision.

Decision:

- D1: C, hybrid isolation. Start with shared database and strict `store_id` isolation, while preserving a future dedicated-database path for selected stores. Superseded on 2026-07-07: use shared database only; do not plan dedicated database per store.
- D2: D, all join mechanisms. Support owner invitation, invite code/link, and owner-email request; owner invitation is the primary path.
- D3: B, platform business-data visibility only after time-limited owner authorization.
- D4: A, self-serve store creation first; platform may add suspension/abuse controls later.

Reason at the time:

- The owner accepted the recommended direction.
- This keeps the first version practical while protecting independent store privacy.
- It avoids overbuilding dedicated databases before the cooperation model is proven.

Impact:

- Phase 1 can start without waiting for more direction choices.
- Future implementation must treat owner-controlled support access as a privacy requirement, not an optional UI detail.
- Platform admin screens should not expose store business data by default.

Superseding rule:

- The active D1 is now shared database with strict `store_id` isolation. Dedicated database per store is not part of the active roadmap.

### 2026-07-04: Phase 1 gated execution contract started

Status: Active.

Decision:

- Use staged small goals with review gates before moving to the next stage.
- Four read-only sub-agents completed Phase 1 baseline review:
  - Product: `019f2eb9-7d31-7e72-9dd9-098cb51a7bc1`.
  - Architecture: `019f2eb9-a06a-7d20-86a7-02ccf7996873`.
  - Data: `019f2eb9-bb39-7f53-b8d3-6e939041a03f`.
  - Security: `019f2eb9-db9c-7a83-a06d-28c57b516d28`.
- The active execution contract is `docs/INDEPENDENT_PARTNER_STORE_PHASE1_EXECUTION_PLAN.md`.

Integrated findings:

- First fix approval boundaries: platform fallback review and store-owner approval must be separate.
- Owner-email request routing must avoid store enumeration and multi-store applicant leakage.
- Self-serve store creation must create a private store and active owner membership without default platform approval.
- Existing-account invitations must not immediately create active membership before invitee acceptance.
- Invite code/link belongs after owner invitation is secure and must include hash storage, expiry, revoke, use limits, and rate limiting.
- Platform support/business-data visibility remains out of Phase 1 and must not be added before Phase 3.

Blocking rule:

- Do not enter Phase 2 tenant isolation audit until Phase 1 blockers in the execution contract are resolved or explicitly accepted with risk.

### 2026-07-04: SG1 approval boundary passed

Status: Passed.

Completed:

- Platform onboarding queue is restricted to `review_scope = platform`.
- Platform approval cannot create private-store join memberships.
- Platform rejection cannot process store-scoped private join requests.
- Store access request queue only shows pending `join_store` requests explicitly routed to the active store.
- Store approval/rejection requires `review_scope = store` and matching `target_store_id`.
- Requester-facing owner-email routed responses hide target store id/name and internal store review scope.
- Owner-email matching uses exact normalized email equality instead of wildcard `ILIKE`.
- Platform and store onboarding audit payloads are minimized.

Checks:

- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run test`: 46 files / 272 tests passed.
- `npm run build`: passed after sandbox escalation for Turbopack build process.
- Final read-only QA gate: passed with no blocker/high findings.

Next:

- Start SG2 owner-email routing refinement. Do not start SG3 until SG2 has tests and review evidence.

### 2026-07-04: SG2 owner-email routing passed

Status: Passed.

Completed:

- Requester-supplied raw `target_store_id` join is rejected by schema and repository before store lookup.
- Join requests now require owner email until invite code/link is implemented as a signed/controlled path.
- Unique owner-email match routes internally to one store queue.
- Zero and multi-match owner-email requests stay in platform fallback.
- Applicant-facing unique/zero/multi responses remain externally indistinguishable.
- Requester redaction covers all `join_store` rows, including malformed or legacy target-store-only rows.
- Stored emails are normalized to lowercase through application write paths and a new additive migration.
- Database guard migration adds lowercase checks, a join-store owner-email check, and owner-email lookup index.

Checks:

- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run test`: 46 files / 277 tests passed.
- `npm run build`: passed after sandbox escalation for Turbopack build process.
- Final read-only QA/security gates: passed with no blocker/high findings.

Next:

- Start SG3 self-serve independent store creation alignment. Do not start SG4 until SG3 has tests and review evidence.

### 2026-07-04: SG3 self-serve store creation passed

Status: Passed.

Completed:

- Create-store onboarding now uses `stores/create` directly instead of platform onboarding approval.
- New independent store creation creates an active store plus active owner membership for the creator.
- The active store cookie/context is set immediately after creation.
- `stores/create` is the only pending/no-store `stores/*` endpoint allowed, and the pending-store router allowlist is method-aware and exact.
- Legacy `create_store` onboarding is blocked at helper, schema, submit repository, review policy, and platform approval repository layers.
- Platform approval no longer creates stores or store memberships.
- Store creation rolls back the new store if owner membership creation fails.
- Production and mock store creation slugs include a random suffix to reduce private store-name inference.

Checks:

- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run test`: 47 files / 283 tests passed.
- `npm run build`: passed after sandbox escalation for Turbopack build process.
- Final read-only QA/security gates: passed with no blocker/high findings.

Residual risk:

- Store creation rollback is application-level, not a database transaction/RPC. Track for Phase 2 hardening before production-scale rollout.

Next:

- Start SG4 final role, applicant cancellation, and rejection visibility. Do not start SG5 until SG4 has tests and review evidence.

### 2026-07-04: SG4 final role, cancellation, and rejection visibility passed

Status: Passed.

Completed:

- Store access approval accepts and persists a final `approved_role`, limited to non-owner roles.
- Store owner/manager approval cannot grant `owner` through join requests.
- Applicant can cancel only their own pending onboarding request through `onboarding/request/cancel`.
- Applicant onboarding UI exposes pending request cancellation, rejected/cancelled decision reasons, and re-submit flow.
- Rejection/cancellation notes remain visible to the applicant after requester redaction.
- Approval, rejection, and cancellation updates re-check pending state to reduce stale-tab and racing decision issues.
- Approval side-effect failure compensation uses a generic applicant-facing note instead of raw internal error text.
- Migration `20260704212000_onboarding_approved_role_and_cancel.sql` adds `approved_role`, backfills approved join requests, blocks owner approved roles, and refreshes PostgREST schema cache.

Checks:

- SG4 target tests: 8 files / 60 tests passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run test`: 48 files / 296 tests passed.
- `npm run build`: passed after sandbox escalation for Turbopack build process.
- `git diff --check` on SG4 files: passed.
- Final read-only QA, Security, and Data gates: passed.

Production preflight retained:

```sql
select count(*) from public.onboarding_requests
where request_type = 'join_store' and status = 'approved' and requested_role = 'owner';

select r.id, r.requested_role, r.approved_role, m.role as membership_role
from public.onboarding_requests r
left join public.store_memberships m
  on m.user_id = r.requester_user_id
 and m.store_id = coalesce(r.resulting_store_id, r.target_store_id)
 and m.status = 'active'
where r.request_type = 'join_store'
  and r.status = 'approved'
  and (r.approved_role is null or m.id is null or m.role <> r.approved_role);
```

Next:

- SG5 owner invitation primary path passed. Start SG6 invite code/link model without reusing email-only invitations as public credentials.

## 2026-07-04T22:16:33Z — SG5 Owner Invitation Passed And SG6 Started

Status:

- SG5 passed local implementation and review gates.
- SG6 invite code/link model is now in progress.

Implemented:

- Owner/manager invitations create or resend pending invitations; they no longer activate existing accounts immediately.
- Invitation acceptance requires logged-in actor email match, pending invited status, and unexpired invitation.
- Invitation role is validated before marking the invitation active, so malformed legacy owner invitations fail without status pollution.
- Owner/manager revoke is available for pending invitations.
- Applicant onboarding can show and accept a pending invitation.
- Settings member flow can show and revoke pending invitations.
- Pre-accept onboarding invitation response is minimized and no longer exposes `store_id`, `invited_by`, or `accepted_at`.
- Migration `20260704220843_store_invitations_non_owner_role.sql` adds the database non-owner invitation check and refreshes PostgREST schema cache.

Validation:

- Target tests: 7 files / 63 tests passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- Full `npm run test`: 49 files / 311 tests passed.
- Scoped `git diff --check`: passed.
- `npm run build`: sandbox failed due known Turbopack port binding permission; non-sandbox rerun passed.
- Security sub-agent gate: PASS.
- QA sub-agent gate: CONDITIONAL pass; Integration Lead accepted the existing non-sandbox build evidence.
- Data sub-agent gate: CONDITIONAL pass for local SG6 progression.

Production preflight before applying SG5 migration:

```sql
select status, count(*)
from public.store_invitations
where role = 'owner'::public.staff_role
group by status;
```

Apply only when the query returns zero rows, or after a separately approved correction plan.

Next:

- SG6 must create a dedicated invite code/link model with hashed code/token storage, expiry, revoke, use-limit, and rate-limit controls.
- SG6 must not expose store business data before authorization and must not log raw invite codes or tokens.

## 2026-07-04T22:47:04Z — SG6 Invite Code/Link Passed And SG7 Started

Status:

- SG6 passed local implementation and read-only QA/Security/Data review gates.
- SG7 Phase 1 closeout gate is now in progress.

Implemented:

- Owner/manager can create and revoke dedicated invite codes/links from store settings.
- Invite codes use hashed storage; raw code is returned once on creation and is not listed in member/invite-link lists.
- Invite links carry non-owner role, expiration, optional max-use limit, used count, creator, active/inactive status, and revoke metadata.
- Logged-in users can redeem a code from onboarding; redemption creates or returns a pending invitation only and does not create active membership.
- Redeem path applies actor/IP attempt rate limiting before link lookup and records service-only attempt audit rows without raw code or plain IP.
- Redeem response is minimized and does not expose `store_id`, `invited_by`, or `accepted_at` before acceptance.
- Mock invite-link redemption now mirrors the production minimized response shape.
- Migration `20260704221944_store_invite_links.sql` adds `store_invite_links`, `store_invite_link_attempts`, hash/result checks, service-role grants, RLS hardening, indexes, and `claim_store_invite_link`.

Validation:

- SG6 target tests: 6 files / 60 tests passed before mock cleanup.
- Post-cleanup targeted tests: 3 files / 33 tests passed.
- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- Full `npm run test`: 49 files / 321 tests passed.
- Scoped `git diff --check`: passed.
- `npm run build`: sandbox failed due known Turbopack port binding permission; non-sandbox rerun passed.
- QA sub-agent gate `019f2f40-eaf8-70c1-84f8-bafcdf0c840c`: PASS.
- Security sub-agent gate `019f2f41-16bb-7ce3-a461-ccf9954ce043`: PASS.
- Data sub-agent gate `019f2f41-3d44-7441-a11e-8952bb9feadc`: PASS.

Production preflight retained:

- Apply SG5 owner-invitation role preflight first.
- Confirm no partial/legacy production `store_invite_links`, `store_invite_link_attempts`, or `claim_store_invite_link(text)` objects exist before SG6 migration, or manually compare definitions before apply.
- After SG6 migration, verify hash constraints, attempt result checks, RLS/grants, RPC execute grant, `used_count <= max_uses`, and PostgREST schema reload.
- Define an invite-link attempt retention window before production-scale rollout.

Next:

- Complete SG7 closeout: final gates, release notes/preflight summary, task memory sync, and final read-only review before Phase 2 tenant isolation audit.

## 2026-07-04T22:54:09Z — SG7 Closeout Passed And Phase 1 Completed Locally

Status:

- Phase 1 store ownership baseline is complete locally.
- Phase 2 tenant isolation audit is ready to start.
- This is not a production release approval.

Final validation:

- `npm run lint`: passed.
- `npx tsc --noEmit --pretty false`: passed.
- Full `npm run test`: 49 files / 321 tests passed.
- Scoped `git diff --check`: passed.
- `npm run build`: non-sandbox production build passed.
- QA final gate: PASS for local closeout and Phase 2 handoff.
- Security final gate: PASS for local closeout.
- Release final gate: CONDITIONAL GO for local closeout; production release remains gated.
- Documentation final gate: CONDITIONAL GO; identified drift was corrected before closeout.

Phase 1 completed baseline:

- Platform fallback review cannot add a user into a private store.
- Owner-email request routing avoids public store listing and store-enumeration leaks.
- Self-serve store creation creates a private store with an owner membership.
- Store owners/managers approve join requests with non-owner final roles.
- Applicants can cancel pending requests and see rejection/cancellation state.
- Owner invitations and invite links create pending invitations only; active membership requires invitee acceptance.
- Invite links have hashed storage, expiry, revoke, use limits, attempt audit, and rate limiting.
- Platform business-data visibility was not added in Phase 1.

Production prerequisites before any rollout:

- Run SG4 legacy approved-owner join and membership reconciliation preflights.
- Run SG5 `store_invitations.role = 'owner'` preflight and correct rows only with separate approval.
- Run SG6 partial-object preflight and post-apply constraint/RLS/grant/RPC/schema-reload checks.
- Define invite-link attempt retention and cleanup ownership.
- Create a production rollback/observability runbook with owner, alert window, and restore/forward-fix steps.

Next:

- Start Phase 2 tenant isolation audit across APIs, storage, tests, platform routes, and data query boundaries.

## 2026-07-04T23:48:41Z — Phase 2 Tenant Isolation Audit Conditional Local Pass

Status:

- Phase 2 local audit and safe hardening passed local gates conditionally.
- This is not a production migration, production RLS/storage verification, deployment, or release approval.

Sub-agents:

- Architecture: `019f2f79-848c-7133-be2e-2e7ca6d3ee7a`.
- Data: `019f2f79-8586-7153-aafc-d4ce8fb00a35`.
- Security: `019f2f79-8630-73a1-90d5-21458a521fd9`.
- QA: `019f2f79-86d5-75b3-8b83-757d344a343b`.
- Final closeout review: `019f2f82-19eb-7a63-8bf6-cd2d2a1bcee0`; no P0/P1 found.

Implemented:

- Customer follow-up reads now prefer active-store filtering before legacy fallback.
- Customer child writes for devices, tags, follow-ups, and outbound messages now assert active-store customer ownership.
- Customer follow-up/message `order_id` links now require same store and same customer.
- Store access approval reads now filter by store review scope and active store at query time.
- Audit log `before_data`, `after_data`, and `metadata` are sanitized for high-risk customer, attachment, credential, message, and overlong fields.
- Platform audit log `before_data` and `after_data` now reuse the same sanitizer.
- Customer outbound-message contact-time updates now fail on zero-row mutation.

Validation:

- Target tests: 5 files / 59 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Full `npm run test`: 50 files / 327 tests passed.
- `npm run build`: sandbox run failed due known Turbopack local port permission; approved non-sandbox rerun passed.

Residual production gates:

- Production Supabase schema, RLS, grants, and storage bucket policies remain unverified.
- Role-level mutation authorization still needs the separately approved role-policy package.
- Store-scoped React Query cache keys, legacy missing-store-column fallbacks, CRM same-store constraints, storage path prefix policy, behavior-level customer repository denial tests, and retention/purge rules remain follow-up hardening items.

Evidence:

- Task report: `.ai-company/memory/tasks/TASK-20260705-001-tenant-isolation-audit/PHASE2_TENANT_ISOLATION_AUDIT_REPORT.md`.

Next:

- Start Phase 3 only after owner approves the support-access model. Phase 3 must implement owner-granted, time-limited platform support visibility before platform staff can view partner-store business data.

## 2026-07-05 — Phase 2.1 Pre-production Isolation Hardening

Status:

- Completed local hardening package under `TASK-20260705-002-phase-21-isolation-hardening`.
- This is not a production migration, production RLS/storage verification, deployment, or release approval.

Implemented locally:

- Added optional active-store suffixes to major business React Query key factories while preserving root prefixes for existing invalidation calls.
- Wired current active store into order, customer, inventory, buyback, messages, dashboard, settings, command-palette, and legacy order route query keys where active store context is available.
- Store switching now removes major business caches for orders, customers, inventory, and message settings before refreshing store context.
- Added behavior-level customer repository tests proving selected cross-store child writes stop before writing devices, follow-ups, or customer interactions.
- Wrote an approval-gated role-policy plan at `.ai-company/memory/tasks/TASK-20260705-002-phase-21-isolation-hardening/ROLE_POLICY_APPROVAL_PLAN.md`.

Explicitly not changed:

- No runtime role-policy enforcement.
- No production Supabase migration, RLS, storage policy, backfill, deploy, or release.
- No platform support-access visibility.

Next:

- Finish local validation and close the Phase 2.1 task with residual production gates.
- Before runtime role-policy enforcement, the Owner must approve the final role matrix and high-risk permissions such as support grants, payment collection, export, and unlock credential visibility.

## 2026-07-05 — Phase 2.2 Role-Policy Approval Package

Status:

- Completed local approval package under `TASK-20260705-003-role-policy-approval-package`.
- This is not runtime permission enforcement, production RLS/storage verification, migration, deployment, or release approval.

Sub-agents:

- Product reviewer: `019f315a-c732-73f1-8992-1bb75da5136b`.
- Security reviewer: `019f315a-f1f3-7ba0-9317-9f513176e9d1`.
- Data reviewer: `019f315b-1f31-7a62-b9aa-ee2fd3626385`.

Completed:

- Wrote `docs/INDEPENDENT_PARTNER_STORE_ROLE_POLICY_APPROVAL_PACKAGE.md`.
- Defined recommended v1 role matrix for owner, manager, technician, frontdesk/current `sales`, and viewer.
- Confirmed `frontdesk` is a product/UI label while v1 internal enum remains `sales` unless a later migration is separately approved.
- Added Owner decision defaults for support grants, unlock visibility, frontdesk payment authority, viewer exports, manager role grants, and last-owner protection.
- Documented server-first enforcement because current repositories use Supabase service-role access; RLS remains defense in depth, not sufficient runtime role enforcement by itself.
- Added explicit follow-up controls for client-side export, unlock credential reads, signed attachment URLs, sensitive-read audit, and production preflight.

Next:

- Ask Owner to approve or edit the v1 role-policy defaults before implementation.
- Do not start runtime enforcement until role defaults are approved.
- Do not apply production Supabase schema/RLS/storage changes without a separate owner-approved release/preflight task.

## 2026-07-05 — Phase 2.3 / Phase B1 Server Permission Module

Status:

- Completed local code-only permission contract under `TASK-20260705-005-phase-b1-server-permission-module`.
- Owner approved all recommended A defaults before implementation.
- This is not route-level enforcement, object-level enforcement, UI permission cueing, production migration, production preflight, deployment, or release.

Completed:

- Added `src/server/permissions.ts`.
- Added `src/server/permissions.test.ts`.
- Defined server-only role/action matrix for `owner`, `manager`, `technician`, current internal `sales`/frontdesk, and `viewer`.
- Implemented default-deny behavior for missing actor, missing store context, unknown/stale role, and system actor unless explicitly allowed for internal context.
- Preserved `sales` as the v1 internal role while allowing UI/product wording to call it `前台`.
- Encoded the approved defaults: frontdesk normal payment collection only, manager/owner money corrections, technician scoped unlock reads, viewer export denial, owner-only support grants and manager-role grants, and elevated owner-transfer/removal actions.
- Confirmed the module is not imported by runtime routes/UI; only the unit test imports it.

Validation:

- `npm run test -- src/server/permissions.test.ts`: passed, 1 file / 14 tests.
- `npx tsc --noEmit --pretty false`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 53 files / 347 tests.
- `npm run build`: sandbox build failed due Turbopack local port permission; approved non-sandbox rerun passed.

Next:

- Phase C should wire high-risk route gates in a separate task, starting with settings, workflow, member, invite, payment correction, export, and support actions.
- Phase D should handle object/field-level authorization for unlock credentials, signed attachment URLs, exports, and technician assignment scope.
- Production Supabase schema/RLS/storage parity remains separately gated.

## Confirmed Choices

### D1: Data isolation

- A: Shared database, strict `store_id`.
- B: Dedicated database per store.
- C: Hybrid: shared first, dedicated option later.

Confirmed: A, revised by owner on 2026-07-07. Previous C/hybrid decision is superseded.

### D2: Join mechanism

- A: Owner invitation only.
- B: Owner-email request.
- C: Invite code/link.
- D: All three, with owner invitation as the primary path.

Confirmed: D.

### D3: Platform visibility

- A: Platform can never view business data.
- B: Platform can view only after time-limited owner authorization.
- C: Platform can view anytime, fully audited.

Confirmed: B.

### D4: Store creation

- A: Owner creates store instantly.
- B: Platform approves every new store.
- C: Instant trial store, platform approval needed for advanced activation.

Confirmed: A now, C later if abuse or billing requires it.

## Next Execution Plan

### Next Step 1: Complete SG7 Phase 1 closeout

After SG6:

- Run final validation gates across Phase 1 changed surfaces.
- Confirm the Phase 1 blocker list has no open local blocker.
- Preserve production migration preflights and residual hardening items in docs and task memory.
- Use read-only sub-agent review before marking Phase 1 ready for Phase 2.

### Next Step 2: Phase 2 isolation audit

After Phase 1:

- Audit every API and repository for store isolation.
- Add cross-store denial tests.
- Audit storage path isolation.
- Review platform APIs for private data exposure.

## Update Rules

Append to this file when:

- Owner makes one of the D1-D4 decisions.
- A phase starts or ends.
- A major implementation task is created.
- A privacy/security rule changes.
- A migration or release related to independent partner stores is applied.

Do not remove historical decisions unless superseded by a new dated entry.
