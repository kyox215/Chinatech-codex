# Independent Partner Store Phase 1 Execution Plan

Last updated: 2026-07-04
Owner: Hexiang Huang / 鹤祥
Status: Active execution contract
Linked plan: `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PLAN.md`
Linked progress: `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`
Task memory: `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/`

## Mission

Phase 1 turns the current multi-store implementation into a privacy-first independent partner-store baseline.

The goal is not to finish every long-term isolation feature. The goal is to make the first runtime model clearly match the owner-approved direction:

- A store is a private tenant owned by its store owner.
- Platform accounts do not get default business-data access.
- Store joining is controlled by the store owner, not by a central company-style admin.
- Existing data paths remain compatible while permission boundaries become stricter.

## Execution Rule

Each small goal must follow this sequence:

1. Implement the smallest coherent change.
2. Run the required local checks.
3. Run review against Product, Architecture, Data, Security, and QA gates.
4. Record evidence in the task memory.
5. Proceed to the next small goal only when the current gate is pass or explicitly accepted as pass-with-risk.

If a blocker is found, stop the phase progression and fix that blocker before continuing.

## Sub-Agent Review Baseline

Four read-only reviewers were used to establish this contract:

| Reviewer | Agent ID | Focus | Result |
|---|---|---|---|
| Product | `019f2eb9-7d31-7e72-9dd9-098cb51a7bc1` | User flows, roles, states, acceptance | Use owner-first sequence; self-serve store creation and platform invisibility come first |
| Architecture | `019f2eb9-a06a-7d20-86a7-02ccf7996873` | Existing boundaries, slices, rollback | Use incremental slices; split platform fallback from store approval |
| Data | `019f2eb9-bb39-7f53-b8d3-6e939041a03f` | Schema, migrations, indexes, validation | Additive migrations only; owner-email routing and final-role audit are Phase 1 requirements |
| Security | `019f2eb9-db9c-7a83-a06d-28c57b516d28` | Threat model, access boundaries | Block platform arbitrary store joins; invitations must require invitee acceptance |

No sub-agent modified files. The main thread owns integration and final verification.

## Phase 1 Small Goals

### SG0: Execution Contract And Gate Setup

Status: passed on 2026-07-04

Purpose:

- Convert the owner-approved direction and sub-agent findings into a staged execution plan.
- Define the pass/fail gates before runtime code changes begin.

Deliverables:

- This document.
- Progress log update.
- Task evidence and checkpoint update.

Required checks:

- `rg` confirms the active Phase 1 contract and gate terms.
- `git diff --check` passes for touched planning and memory files.

Exit gate:

- Product, architecture, data, and security reviewer findings are represented in this plan.
- Next small goal is clearly ordered.
- Validation evidence: `rg` confirmed contract/gate terms and sub-agent IDs; `git diff --check` passed for touched SG0 files.

### SG1: Platform And Store Approval Boundary

Status: passed on 2026-07-04

Purpose:

- Separate platform fallback review from store-owner approval.
- Prevent platform approval from directly adding an applicant into an arbitrary active private store.

Implementation scope:

- `platform/onboarding/*` only handles platform-scope fallback requests.
- `stores/access-requests/*` handles store-scoped join requests with a concrete target store.
- Platform fallback cannot approve a private-store join by choosing `target_store_id`.
- Store owner or authorized manager must be the approval actor for joining a private store.

Required checks:

- Unit/model tests for platform queue filtering by `review_scope`.
- Unit/model tests proving platform approval cannot create a private-store membership.
- Store owner approval still works for store-scoped requests.

Exit gate:

- Security: no platform route can silently bypass store owner approval.
- Data: request state changes remain compatible with existing rows.
- Architecture: no large router/repository rewrite.
- Validation evidence: platform/store policy tests, platform repository tests, store repository tests, full lint, typecheck, full test suite, production build, and final read-only QA gate passed.

Blockers:

- Any path that lets platform admin pick Store B and add a user to Store B without store owner approval.

### SG2: Owner-Email Request Routing

Status: passed on 2026-07-04

Purpose:

- Keep owner-email request as a private fallback path without listing stores or leaking matches.

Implementation scope:

- If owner email uniquely maps to one active owner/manager store, route the request to that store.
- If owner email maps to zero stores or multiple stores, route to platform fallback review without exposing store name/id.
- Store queues only show requests explicitly routed to that store.
- Applicant responses use the same external wording for unique, zero, and multi-match cases.

Required checks:

- Unique match routes to one store queue.
- Zero match goes to platform fallback.
- Multi-match goes to platform fallback and appears in no store queue.
- Applicant-facing response does not reveal whether the email matched a store.

Exit gate:

- Product: request flow stays understandable.
- Security: no store enumeration or multi-store applicant leakage.
- Data: email matching is normalized and index-compatible.
- Validation evidence: repository/schema/policy tests, static migration guard, full lint, typecheck, full test suite, production build, and final read-only QA/security gates passed.

### SG3: Self-Serve Independent Store Creation Alignment

Status: passed on 2026-07-04

Purpose:

- Align onboarding with owner decision D4: a new owner can create a private store directly.

Implementation scope:

- The create-store path creates a store and an active owner membership for the creator.
- Platform approval is not required for the default create-store path.
- Abuse/manual review can be planned later, but must not be the default Phase 1 behavior.

Required checks:

- New account can create a store and become owner.
- New store is not visible to other stores.
- Platform queue does not receive ordinary self-serve store creation requests.

Exit gate:

- Product: onboarding text clearly says private independent store.
- Security: store is private immediately.
- Data: every active store has an active owner.
- Validation evidence: onboarding create-store now calls `stores/create`; pending/no-store access uses a method-aware exact allowlist; legacy `create_store` onboarding submission and platform approval are blocked; creator gets an active owner membership and active-store cookie/context; owner membership failure rolls back the new store; production and mock slugs include random suffixes; full lint, typecheck, test suite, production build, and final read-only QA/security gates passed.

Residual risk:

- Store creation still uses application-level rollback rather than a database transaction/RPC. Treat this as a Phase 2 hardening candidate before production-scale rollout.

### SG4: Final Role, Cancellation, And Rejection Visibility

Status: passed on 2026-07-04

Purpose:

- Complete the request lifecycle so the store owner can approve with a final role and applicants can understand/stop their request.

Implementation scope:

- Add a final approved role to approval input and persistence.
- Store owner cannot approve `owner` role through join requests.
- Applicant can cancel their own pending request.
- Rejection reason is visible to the applicant.

Required checks:

- Requested manager approved as viewer results in viewer membership.
- Approval as owner is rejected.
- Applicant cancellation moves pending request to cancelled.
- Rejected applicant sees decision reason and can reapply.

Exit gate:

- Product: applicant has a clear status.
- Data: requested role and approved role remain auditable.
- Security: no role escalation to owner.

Validation evidence:

- `approved_role` is accepted only for non-owner roles and persisted with approved store access requests.
- Store owner/manager approval cannot grant `owner`; schema, repository sanitizer, and migration check all enforce this.
- Applicant can cancel only their own pending request through `onboarding/request/cancel`.
- Applicant onboarding UI exposes pending cancellation, rejected/cancelled decision notes, and re-submit flow.
- Approval, rejection, and cancellation update predicates re-check `status = pending` to reduce stale-state races.
- Approval side-effect failure compensation uses a generic applicant-facing note and does not expose internal error text.
- Migration `20260704212000_onboarding_approved_role_and_cancel.sql` adds `approved_role`, backfills approved join requests, forbids owner approved roles, and refreshes PostgREST schema cache.
- Validation: target tests passed with 8 files / 60 tests; `npm run lint` passed; `npx tsc --noEmit --pretty false` passed; full `npm run test` passed with 48 files / 296 tests; production `npm run build` passed after non-sandbox Turbopack rerun; scoped `git diff --check` passed.
- Final read-only QA, Security, and Data review gates passed.

Production preflight retained:

- Run legacy approved-owner join validation before applying the migration.
- Confirm backup/restore readiness.
- Verify approved join requests still have matching active store memberships after migration.
- Confirm PostgREST schema reload after `pg_notify`.

### SG5: Owner Invitation Primary Path

Status: passed

Purpose:

- Make owner invitation the preferred joining path without silently activating memberships.

Implementation scope:

- Owner or authorized manager creates an invitation for an email and non-owner role.
- Invitation remains pending until the invitee logs in/registers and accepts.
- Existing-account invitations must not immediately create active membership.
- Invitation can expire, be revoked, and be resent.

Required checks:

- Existing account invited to Store A has no access before accepting.
- Invitation accept activates the correct non-owner role.
- Expired/revoked invitations cannot be accepted.
- Duplicate active member invite is blocked.

Exit gate:

- Security: no invitee acceptance, no business-data access.
- Product: Settings member flow clearly shows pending/accepted/revoked.
- Data: raw tokens/codes are never logged.

Validation evidence:

- Owner/manager invitation now creates or resends a pending `store_invitations` row and does not create an active membership for an existing account.
- Invitee acceptance is routed through `onboarding/invitations/accept`, requires logged-in non-system actor, matches the actor email, and re-checks `status = invited` plus `expires_at > now` before creating membership.
- Invitation role is validated as non-owner before the invitation is marked `active`; malformed legacy owner invitations fail without state pollution.
- Owner/manager can revoke pending invitations through `stores/invitations/revoke`; revoked, expired, stale, wrong-email, and owner-role invitations cannot be accepted.
- Applicant onboarding shows a pending invitation accept path; Settings members show pending invitations and revoke action.
- Pre-accept onboarding invitation response is minimized and does not expose `store_id`, `invited_by`, or `accepted_at`.
- Migration `20260704220843_store_invitations_non_owner_role.sql` adds `store_invitations_role_not_owner_check` and refreshes PostgREST schema cache.
- Validation: target tests passed with 7 files / 63 tests; `npm run lint` passed; `npx tsc --noEmit --pretty false` passed; full `npm run test` passed with 49 files / 311 tests; `npm run build` passed after non-sandbox Turbopack rerun; scoped `git diff --check` passed.
- Final read-only Security gate passed. QA and Data gates conditionally passed; Integration Lead accepted the existing non-sandbox build evidence, and Data's production preflight remains mandatory.

Production preflight retained:

- Before applying `20260704220843_store_invitations_non_owner_role.sql` in production, run:

```sql
select status, count(*)
from public.store_invitations
where role = 'owner'::public.staff_role
group by status;
```

- Apply the migration only when the query returns zero rows, or after a separately approved data correction plan.
- Confirm backup/restore readiness and avoid executing the constraint migration during a store-invitation write spike.

### SG6: Invite Code / Invite Link Model

Status: passed on 2026-07-04

Purpose:

- Add a safer code/link joining mechanism only after the owner invitation path is secure.

Implementation scope:

- Prefer a dedicated invite-link model instead of overloading email-only invitations.
- Store only hashed codes/tokens.
- Include default non-owner role, expiration, optional use limit, used count, creator, revoke metadata.
- Redemption should default to pending membership/request unless explicitly designed otherwise.

Required checks:

- Expired, revoked, over-limit, and reused links fail.
- `max_uses=1` concurrent redemption succeeds once.
- Code redemption does not reveal store data before authorization.
- Raw token/code is not stored in logs.

Exit gate:

- Data: additive migration is reviewed.
- Security: rate limit, expiry, revoke, use-limit, and hash storage are covered.
- QA: concurrency and failure-state tests exist.

Validation evidence:

- Dedicated `store_invite_links` model uses hashed invite codes/tokens only; raw code is returned once on creation and is not listed later.
- `store_invite_link_attempts` records redemption attempts with `code_hash` and optional `ip_hash`; anonymous/authenticated access is revoked and service role owns server-side writes.
- Redeem path enforces a 15-minute actor/IP attempt window before link lookup, then applies active, expiry, use-limit, existing-member, and existing-invitation guards.
- Redeem response uses a minimized public invitation shape and does not expose `store_id`, `invited_by`, or `accepted_at` before acceptance.
- Mock API redemption was aligned with the production public response shape.
- Validation: target tests passed with 6 files / 60 tests before mock cleanup; post-cleanup targeted tests passed with 3 files / 33 tests; `npm run lint` passed; `npx tsc --noEmit --pretty false` passed; full `npm run test` passed with 49 files / 321 tests; scoped `git diff --check` passed; `npm run build` passed after non-sandbox Turbopack rerun.
- Final read-only QA, Security, and Data review gates passed after the rate-limit and response-minimization fixes.

Production preflight retained:

- Apply SG5 migration preflight first and confirm no `store_invitations.role = 'owner'` rows remain.
- Confirm production does not already contain partial `store_invite_links`, `store_invite_link_attempts`, or `claim_store_invite_link(text)` objects before applying SG6 migration.
- After apply, verify token/hash constraints, attempt result checks, RLS/grants, RPC execute grant, `used_count <= max_uses`, and PostgREST schema reload.
- Define attempt retention/cleanup, for example 90 or 180 days, before production-scale rollout.
- Track Phase 2 hardening candidate: merge invite-link claim and pending invitation insert into one transactional RPC.

### SG7: Phase 1 Closeout Gate

Status: passed on 2026-07-04

Purpose:

- Confirm Phase 1 is ready to hand off to Phase 2 tenant isolation audit.

Required checks:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- Targeted onboarding/member/security tests pass.
- `git diff --check`

Exit gate:

- Platform cannot view business data by default.
- Platform cannot add members to a private store without store-owner-controlled path.
- Store joining works through owner invitation, code/link, or owner-approved request.
- No public store list exists.
- Progress and task memory are updated.

Validation evidence:

- Final local gates passed: `npm run lint`, `npx tsc --noEmit --pretty false`, full `npm run test` with 49 files / 321 tests, scoped `git diff --check`, and non-sandbox `npm run build`.
- Final QA review passed for local Phase 1 closeout and Phase 2 handoff.
- Final Security review passed for local Phase 1 closeout.
- Release review returned conditional go for local closeout; the required SG7 evidence/status sync has been completed. Production remains no-go until production preflights, observability, and rollback ownership are explicitly executed/approved.
- Documentation review returned conditional go; the identified drift was fixed in the platform plan, task facts, evidence, and project memory.

Phase 2 handoff:

- Phase 1 proves the owner-controlled joining baseline, not full tenant isolation.
- Phase 2 must audit every API, storage path, platform route, and data query for cross-store isolation.
- Phase 3 remains the first phase allowed to design platform support/business-data visibility, and only through owner-granted, time-limited, audited support access.

## Blockers That Stop Phase Progression

- Platform can approve a join into any private store by providing `target_store_id`.
- Owner-email matching reveals whether a store exists or exposes one applicant to multiple stores.
- Existing-account invitation creates active membership before invitee acceptance.
- Invite code/link is enabled without hash storage, expiry, revoke, use limit, and rate limiting.
- Any Phase 1 code path adds platform business-data visibility before Phase 3 support access is designed.
- Audit logs store raw invite tokens/codes or unnecessary business data snapshots.

## Phase 1 File Areas

Likely touched during implementation:

- `src/features/auth/model/onboarding-flow.ts`
- `src/features/auth/screens/onboarding-screen.tsx`
- `src/features/platform/server/platform.repository.ts`
- `src/features/platform/model/onboarding-queue.ts`
- `src/features/platform/screens/platform-admin-screen.tsx`
- `src/features/stores/server/store.repository.ts`
- `src/features/stores/server/store.service.ts`
- `src/features/stores/testing/mock-api.ts`
- `src/lib/repairdesk/api.ts`
- `src/lib/repairdesk/types.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`
- `supabase/migrations/*`

Implementation must keep write ownership scoped per small goal and update this document when the sequence changes.

## Progress Update Rules

After each small goal:

- Update the status in this file.
- Append a dated entry to `docs/INDEPENDENT_PARTNER_STORE_PLATFORM_PROGRESS.md`.
- Add evidence to `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/EVIDENCE.md`.
- Add a checkpoint to `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/CHECKPOINTS.md`.
- If a decision or durable rule changed, update `.ai-company/memory/tasks/TASK-20260704-009-independent-partner-store-platform/MEMORY_DELTA.md`.
