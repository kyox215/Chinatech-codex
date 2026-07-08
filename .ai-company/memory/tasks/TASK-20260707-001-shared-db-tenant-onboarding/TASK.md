---
schema_version: 1
task_id: "TASK-20260707-001-shared-db-tenant-onboarding"
title: "Shared database tenant onboarding plan and staged execution"
status: "active"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Product", "Data", "Security", "Architecture", "Documentation"]
created_at: "2026-07-07T10:50:50Z"
updated_at: "2026-07-07T18:48:24Z"
---
# Task — Shared Database Tenant Onboarding Plan And Staged Execution

## Owner Request

Generate a complete plan, set a goal, and begin phased execution with sub-agents. The owner clarified that RepairDesk must use one shared database with complete store isolation, while feature logic and schema changes apply to all stores.

## Business Value

Support independent partner stores without the cost and complexity of one database per store, while preserving privacy and making future feature updates consistent across all stores.

## Scope In

- Create the authoritative same-database tenant onboarding execution plan.
- Replace dedicated-database assumptions with strict shared database isolation.
- Use real read-only sub-agents for product, data, and security review.
- Start Phase 0 documentation/task-memory execution.
- Define Phase 1 implementation path for registration and onboarding UX.

## Scope Out

- No production migration.
- No deploy or push.
- No runtime code behavior changes until Phase 1 is explicitly started after plan review integration.
- No platform support access to store business data.
- No one-database-per-store architecture.

## Acceptance Criteria

- [x] Plan document exists and records the shared database decision.
- [x] Progress/platform plan docs are updated to remove near-term dedicated DB assumptions.
- [x] Real sub-agents return product/data/security review outputs.
- [x] Integrated plan lists phases, stop conditions, file ownership, and validation gates.
- [x] Memory checkpoint records Phase 0 and next action.

## Sub-Agents

| Department | Agent | Mode | Status |
|---|---|---|---|
| FLOW / Product | Iris `019f3c34-a726-7121-9864-b4394aa6ba39` | read_only | completed; findings integrated |
| DATA | Delta `019f3c35-0abb-7130-bdf5-cd36dcf65a9d` | read_only | completed; findings integrated |
| SEC | Aegis `019f3c35-4ecd-7d40-aafd-b3901ca62ff8` | read_only | completed; findings integrated |

## Current Decisions

- Shared database with strict `store_id` isolation is the target.
- Functional logic and schema migrations are global to all stores.
- Store-specific differences use settings or feature flags, not code forks.
- Registration routes immediately to create-store or join-store choice.
- Create-store creates a private store workspace in the shared DB and sets the registrant as owner.
- Join-store never lists stores and must use owner email, invite code/link, or owner invitation.

## Phase 0 Integrated Findings

### FLOW / Product

- Onboarding state priority should be active store, pending invitation, pending request, latest decision, then create/join choice.
- Platform fallback for zero/multiple owner-email matches remains a product decision because platform cannot approve private-store joins.
- Pending join request versus create-store needs explicit behavior; default recommendation is cancel-before-create.
- Settings approval should expose final non-owner role selection.
- Create-store needs server-side duplicate/race protection beyond client disabled state.

### DATA

- Existing migrations already establish shared DB/store_id direction, but service-role repositories remain the primary guard because service role bypasses RLS.
- Create-store should become an atomic or recoverable provisioning operation that initializes store, owner membership, settings, workflows, templates, and audit metadata.
- Store lifecycle needs an invariant that every active store has at least one active owner.
- Invite-link claim plus pending invitation creation should become atomic or compensating.
- Legacy default-store fallback writes must be removed or proven unreachable before full-isolation claims.
- Live Supabase schema/RLS/storage parity must be verified before production isolation claims.

### SEC

- Verified email is a release blocker for create-store, join request, invite redemption, and invitation acceptance.
- Manager-level access grants must be owner-only by default; repository checks must align with the server permission matrix.
- Unsafe cookie-authenticated mutations need CSRF/Origin protection, not only SameSite cookie assumptions.
- Onboarding abuse controls must cover create-store, owner-email requests, invite redemption, and cancel/reapply loops.
- Invite/link attempt audit must avoid raw codes/tokens and unnecessary PII.

## Next Phase Recommendation

Start Phase 1 with the onboarding/auth contract and tests:

1. Add verified-email gating at the actor/auth-context or route/repository boundary.
2. Add cross-origin mutation rejection for onboarding/store/member mutation routes.
3. Align member-management checks with `src/server/permissions.ts`, beginning with owner-only manager grants.
4. Add rate-limit coverage for create-store and owner-email join requests.

Do not start production database/RLS changes until the local contract and tests pass.

## Phase 1 Execution Contract — Local Auth/Onboarding Guardrails

Status: in_progress.

### Goal

Implement the first local code slice required before production onboarding rollout:

1. Verified-email gate for create-store, join request, invite redemption, and invitation acceptance.
2. Owner-only manager-level grants and approval checks aligned with `src/server/permissions.ts`.
3. CSRF/Origin protection for unsafe cookie-authenticated `/api/repairdesk` mutations.
4. Abuse throttles for create-store and owner-email join requests where feasible without production schema changes.

### Scope In

- Server-side auth actor metadata and guard helpers.
- `/api/repairdesk` route wrapper mutation-origin checks.
- Store/platform repository guardrails and focused tests.
- Router/schema tests only where contracts change.
- Task memory and plan/progress updates.

### Scope Out

- No production migration or live Supabase RLS/storage changes.
- No deploy, push, or release.
- No one-database-per-store implementation.
- No platform support business-data visibility.
- No broad UI redesign unless a small copy/state change is required by the server contract.

### Phase 1 Sub-Agents

| Department | Agent | Mode | Status | Work package |
|---|---|---|---|---|
| ARCH/API | Atlas `019f3c51-7403-7f30-a71b-040fe919215b` | read_only | completed | Mapped current implementation paths and tests |
| SEC | Cipher `019f3c51-a07c-7570-91ea-3a382f9b46b4` | read_only | completed | Reviewed verified-email, owner-only grants, CSRF/Origin plan |
| DATA | Index `019f3c51-d015-7070-a2f3-9d368842c523` | read_only | completed | Reviewed no-migration rate-limit/data approach |

### Main Thread Immediate Work

- Inspect current auth/router/repository code.
- Create the minimal local implementation plan.
- Wait for sub-agent findings before finalizing code changes that touch security-sensitive paths.

### Validation Target

- Focused unit tests for auth actor, route origin guard, store repository, platform repository, and router allowlist.
- Then `npm run typecheck`, targeted tests, and broader tests as time/risk require.

### Phase 1 Result

Status: completed locally.

Implemented:

- `AuditActor.emailVerified` and server-side verified-email enforcement for create-store, join request, invite redemption, and invitation acceptance.
- Unsafe `/api/repairdesk` POST guard for browser `Origin`, `Sec-Fetch-Site`, and JSON content-type checks.
- Owner-only manager grants aligned with the permission matrix for invitations, invite links, and store access approvals.
- No-migration soft throttles for create-store and owner-email join requests.

Validation passed:

- `npm run lint`
- `npm run typecheck`
- Targeted Vitest: `src/server/api/repairdesk-request-guard.test.ts`, `src/server/api/repairdesk-router.test.ts`, `src/features/stores/server/store.repository.test.ts`, `src/features/platform/server/platform.repository.test.ts`, `src/server/permissions.test.ts`
- Full Vitest: `npm run test`
- Production build: `npm run build` passed outside sandbox after the first sandbox attempt failed only on Turbopack port binding permission.

Residual risks deferred:

- Soft throttles are best-effort and not yet durable race-proof database limits.
- POST guard is browser-header based; a token-backed CSRF layer remains a later hardening option.
- Invite/link attempt audit still needs a retention and PII-minimization migration before production rollout.
- Store creation is safer than before but not yet a single transaction/RPC provisioning unit.

## Phase 2 Execution Contract — Store Creation Provisioning Hardening

Status: completed locally with durable idempotency deferred to database/RPC phase.

### Goal

Make creating a new partner store repeatable, recoverable, and complete enough that a store is not usable until owner membership and required defaults exist.

### Scope In

- Inspect current store defaults and workflow/template initialization paths.
- Add or prepare an application-level provisioning helper for store settings, workflow statuses/transitions, message templates, and required numbering/settings rows.
- Improve duplicate-submit/idempotency behavior without production schema changes where possible.
- Keep owner membership failure rollback behavior and add tests for default-initialization failure paths.
- Record which guarantees still require a later database RPC or migration.

### Scope Out

- No production migration or live Supabase mutation.
- No deploy or push unless the owner explicitly asks after validation.
- No dedicated database per store.
- No broad UI redesign.

### Phase 2 Sub-Agents

| Department | Agent | Mode | Status | Work package |
|---|---|---|---|---|
| DATA | Gaia `019f3c61-20d4-7c30-88aa-e568f491228d` | read_only | completed | Mapped required store default rows and failure invariants |
| ARCH/API | Nova `019f3c61-4ed9-7200-a711-5746d36a21cb` | read_only | completed | Reviewed provisioning boundary and router/API contracts |
| SEC/QA | Sentinel `019f3c61-75d9-77b1-9431-354a5cc78c56` | read_only | completed | Reviewed duplicate-submit, recovery, and privacy risks |

### Validation Target

- Focused tests in store repository and router where API contracts change.
- `npm run lint`
- `npm run typecheck`
- Targeted Vitest for store provisioning paths.
- Broader `npm run test` and `npm run build` if Phase 2 touches shared server contracts.

### Phase 2 Result

Implemented:

- Added `src/features/stores/server/store-provisioning.ts` as the application-layer provisioning boundary.
- New stores are inserted as `suspended`, receive defaults, receive owner membership, and are activated only after those steps succeed.
- Default provisioning creates store settings, message templates, order workflow statuses, and order workflow transitions.
- Workflow seed uses explicit server defaults aligned with migration fixes instead of deriving from UI/mock helpers.
- Public create-store failures now use generic messages for provisioning, membership, and activation failures.
- Failure paths clean provisioned rows before deleting the store, respecting `store_settings` and `message_templates` FK restrictions.

Validation passed:

- `npm run lint`
- `npm run typecheck`
- Targeted store repository tests: 34 tests.
- Targeted guard/router/store/platform/permissions suite: 5 files / 70 tests.
- Full Vitest: 76 files / 501 tests.
- `git diff --check` for current task files.

Validation blocked:

- `npm run build` rerun is temporarily blocked by an unrelated active `npm run test:e2e:desktop` / `next start -p 3011` process holding Next build/start state. Earlier Phase 1 build passed outside sandbox.

Residual risks deferred:

- True idempotency for duplicate create-store submissions requires a database-backed request table or RPC.
- True atomicity requires a transaction/RPC such as `create_store_with_defaults`.
- Active-store-has-owner invariant still needs database-backed validation or lifecycle constraints.
- Live Supabase RLS/storage parity is not yet verified.

## Phase 3 Execution Contract — Join Store Privacy And Owner Approval

Status: completed locally; security PASS and QA CONDITIONAL without Phase 3 blocker.

### Goal

Ensure joining an existing private partner store never exposes store lists, owner existence, store names, or business data, and that store owner approval remains the only path into a private store.

### Scope In

- Owner-email request response shape and status behavior.
- Store access request approval/rejection boundaries.
- Invite code/link privacy behavior and generic external errors.
- Settings owner approval final-role selection contract where server APIs already support it.
- Tests for zero/one/multiple owner-email matches and wrong-email invite acceptance.

### Scope Out

- No production migration or live Supabase mutation.
- No platform support access to store business data.
- No public existing-store list.
- No owner-role approval through join paths.

### Phase 3 Sub-Agents

| Department | Agent | Mode | Status | Work package |
|---|---|---|---|---|
| PRODUCT | Mira `019f3c73-00e0-7871-b20f-6557f334de45` | read_only | completed | Reviewed join-store UX states and owner approval wording |
| SEC | Aegis the 2nd `019f3c73-30f1-79d1-9ead-63a023524bd4` | read_only | completed | Found owner-only, unverified invitation, reviewer-id, raw-error, and audit PII gaps |
| QA | Verity the 2nd `019f3c73-5e7e-7ec3-b541-9b682508a22e` | read_only | completed | Defined missing Phase 3 privacy and role-boundary tests |
| SEC re-review | Cipher the 2nd `019f3c81-ef04-7322-8df7-80ca3534f28f` | read_only | completed PASS | Post-fix security gate review |
| QA re-review | Gauge the 2nd `019f3c82-285e-77a3-b8d6-7e17837fcca4` | read_only | completed CONDITIONAL | Post-fix acceptance/test review |

### Validation Target

- Platform repository privacy tests.
- Store repository invite/approval tests.
- Router/schema tests if API response contracts change.
- `npm run lint`, `npm run typecheck`, targeted Vitest, and full Vitest if shared contracts change.

### Phase 3 Result

Implemented:

- `getOnboardingStatus` no longer queries invitation/store-name data for unverified emails.
- Requester join-request responses redact target store id/name and reviewer internal identifiers.
- Store access request list/approve/reject is owner-only; managers cannot process any join request.
- Settings owner approval UI now includes a final non-owner role selector and sends `approved_role`.
- Join request schema rejects requester-supplied `target_store_id`.
- Owner-email lookup and approval side-effect failures return generic public errors.
- Invite-link attempt audit writes no raw `actor_email`.
- Onboarding copy avoids claiming that an unmatched owner email reached the owner queue.

Validation passed:

- `npm run lint`
- `npm run typecheck`
- Targeted Phase 3 suite: 5 files / 75 tests.
- Full Vitest: 76 files / 510 tests.
- `npm run build` passed outside sandbox; sandbox build failed only on Turbopack port binding permission.

Residual risks deferred:

- Settings approval role selector still needs a browser/component interaction test before production release.
- DB-level protection for direct writes that combine `target_owner_email` and `target_store_id` belongs to Phase 5.
- Durable invite-code claim plus invitation creation atomicity remains Phase 5 database/RPC work.
- Production cleanup/retention for the existing `actor_email` invite-attempt column remains Phase 5 work.
- Full generic error mapping for all low-level DB paths remains Phase 4/5 hardening.
- Zero/multiple owner-email fallback product handling remains open for stale platform-scoped requests.

## Phase 4 Execution Contract — Cross-Domain Tenant Isolation Audit

Status: completed locally; awaiting full validation gate and Phase 5 owner-approved live database/RLS work.

### Goal

Audit all store-scoped business domains and close the highest-risk local gaps so Store A cannot list, search, detail, mutate, export, cache, or infer Store B data through service-role repositories or client cache.

### Scope In

- Orders, customers, inventory, messages/settings, attachments, suppliers, and dashboard reads/writes.
- Server repository `store_id` predicates for list/detail/write paths.
- Client query-key active-store scoping where data differs by store.
- Legacy default-store fallback detection.
- Cross-store denial tests for representative high-risk paths.

### Scope Out

- No production migration.
- No live Supabase RLS/storage mutation.
- No deploy or push unless separately requested.
- No broad UI redesign.

### Phase 4 Sub-Agents

| Department | Agent | Mode | Status | Work package |
|---|---|---|---|---|
| DATA / Repository audit | Gaia the 2nd `019f3c88-2f2c-7161-954d-80e08ab2d383` | read_only | completed | Found fail-open customer PII fallback, message fallback, raw storeId transition risk, mock fail-open risk |
| ARCH/API | Daedalus the 2nd `019f3c88-5a6c-7c40-b9fb-089e5d9d655e` | read_only | completed | Mapped App Router -> repairdesk router -> feature repositories; recommended source fail-closed and centralized cache purge |
| SEC/QA | Sentinel the 2nd `019f3c88-8b77-7120-8861-4201667c1e26` | read_only | completed | Confirmed message fallback blocker and attachment path/cache test gaps |

### Validation Target

- `npm run lint`
- `npm run typecheck`
- Focused tests for any repaired tenant boundaries.
- Full Vitest if shared repository or API contracts change.

### Phase 4 Result

Implemented:

- Customer child data and message settings/templates now fail closed on `store_id` schema/cache errors; unscoped fallback queries were removed.
- Production source mode now requires real Supabase service/browser auth config and forbids E2E bypass/mock fallback.
- Store switch cache clearing is centralized and immediately writes the new store context before tenant-scoped cache removal.
- Order and inventory attachment signed URL creation now validates fixed storage bucket and `${storeId}/${objectId}/` path prefix; invalid metadata loses URL trust.
- `transitionOrder` no longer accepts a raw `storeId` option and derives store context from the actor.

Validation passed:

- Targeted Phase 4 suite: 7 files / 36 tests.
- `npm run typecheck`
- `npm run lint`
- Full `npm run test`: 81 files / 528 tests.
- `npm run build` passed outside sandbox after sandbox Turbopack port-binding failure.
- `git diff --check` passed for current task files.

Remaining before task close:

- Phase 4 memory checkpoint.
- Phase 5 live database/RLS/storage verification plan and owner approval gate.

## Phase 5 Execution Contract — Live Database/RLS/Storage Verification

Status: Owner approved read-only live preflight; linked CLI preflight is blocked on migration history mismatch before full live SQL verification.

### Goal

Prove that the live shared Supabase database has the same tenant-isolation guarantees as the local code and migration plan before any production-grade isolation claim.

### Scope In

- Read-only live schema, constraint, RLS, grant, storage bucket, and attachment metadata verification.
- Backup/restore and rollback/forward-fix plan before any approved mutation.
- No-go thresholds for null/default `store_id`, unvalidated constraints, public buckets, public URLs, and direct grants.

### Scope Out

- No linked migration apply without explicit Owner approval.
- No production data backfill/delete/anonymize/move without explicit Owner approval.
- No deploy, push, alias, or release from this phase without separate approval.

### Phase 5 Sub-Agents

| Department | Agent | Mode | Status | Work package |
|---|---|---|---|---|
| DATA / Migration verification | Delta the 2nd `019f3ca0-bb36-7653-a49d-f94c2793b3f8` | read_only | completed before compaction | Validated table/constraint/query plan from local migrations |
| SEC / RLS storage review | Cipher the 3rd `019f3ca0-ec13-73a1-ae98-7cac034aa09a` | read_only | completed before compaction | Reviewed RLS, storage, service-role, and privacy proof requirements |
| RELEASE / Runbook | Orbit the 3rd `019f3ca1-0f00-7a11-bfb9-7f894df6ed6c` | read_only | completed before compaction | Reviewed approval, backup, dry-run, observation, and rollback plan |
| DATA / Migration verification | Gaia the 3rd `019f3cab-c9f9-7eb1-9539-e09cece1c416` | read_only | completed | Found SQL correctness gaps and required migration/control-plane/realtime/default-data checks |
| SEC / RLS storage review | Sentinel the 3rd `019f3cab-cabb-7db1-94b3-688a867d3ecd` | read_only | completed | Required behavior-level RLS/Storage smokes, service-role repository matrix, and audit retention checks |
| RELEASE / Runbook | Harbor the 3rd `019f3cab-cb7f-7c30-abf6-476d0c8d91ef` | read_only | completed | Confirmed production migration/release/global rollout no-go; conditional-go for owner-approved read-only Phase 5 verification |
| DATA / Final query proof | Index the 2nd `019f3caa-70bd-71e2-ab60-0585f9c0c912` | read_only | completed | Required expected-table left joins, full default-store residue coverage, expected same-store FK matrix, and control-plane checks |
| SEC / Final leak and bypass proof | Cipher the 2nd `019f3caa-71b2-74c3-9d96-338488dc6478` | read_only | completed | Required counts-only attachment/storage evidence, routine/security-definer grant checks, storage parity, and support-access no-go |
| RELEASE / Final release proof | Orbit the 2nd `019f3caa-727e-7ad0-9370-7a93b1028c35` | read_only | completed | Required backup artifact/restore proof, query-pack audit trail, operational owners, no-go mapping, and observation metrics |
| DOC / Final plan consistency | Ledger the 3rd `019f3cbc-a0a6-7df2-9495-ad3d384b6655` | read_only | completed | Found status/table/decision-list drift before Owner approval request |
| RELEASE / Final gate check | Beacon the 3rd `019f3cbc-a1d2-7d33-9a89-c93d8ad1d79c` | read_only | completed | Confirmed Phase 6 no-go and Phase 5 read-only verification conditional-go only after Owner approval |
| DATA / Query pack review | Index the 3rd `019f3cca-3003-7241-9316-26fef37ec261` | read_only | completed | Required hash capture, block manifest, realtime migration handling, workflow constraints, and offline draft object checks |
| SEC/RELEASE / Approval review | Aegis the 3rd `019f3cca-3108-7192-baed-3c027f1ef86f` | read_only | completed | Confirmed approval-gated live verification and required clearer read-only approval wording |
| QA / Approval package consistency | Verity the 3rd `019f3cd4-2f96-7a73-8450-c877b5833551` | read_only | completed CONDITIONAL PASS | Confirmed approval gating and required template/wording/history cleanup |
| PROJECT / Migration history search | Scout the 3rd `019f3cdd-03b2-79d2-be94-7a38a0a36ebe` | read_only | completed | Found no exact local files/history paths for the seven remote-only versions; mapped three names to differently timestamped local SQL |
| DATA / Migration reconciliation review | Delta the 3rd `019f3cdd-457e-7cd3-9dd2-a72c6f2a061c` | read_only | completed BLOCK | Confirmed full live SQL query pack remains blocked until migration history is reconciled or exceptions are approved |
| DATA / Migration gate | Gaia the 4th `019f3cf9-dcee-73b0-8977-53b51597fcf6` | read_only | completed BLOCK | Confirmed Phase 5 full live SQL query pack remains blocked and exact SQL/remediation manifest is required |
| SEC / Tenant isolation gate | Sentinel the 4th `019f3cfa-0019-79d1-a15c-762783142eea` | read_only | completed BLOCK | Confirmed migration-history drift can make RLS/tenant verification misleading and release gate must stay closed |
| RELEASE / Phase 5-6 gate | Orbit the 4th `019f3cfa-2452-7cd2-9507-3a707c9e4301` | read_only | completed BLOCK | Confirmed docs are enough only for continued read-only recovery, not Phase 5 query pack, Phase 6, deploy, or production release |
| PROJECT / Local archive recovery search | Atlas the 4th `019f3cfe-588e-71f3-b9cb-36c57ae6f890` | read_only | completed | Searched local non-Supabase archive sources; no exact SQL recovered; `Chinatech-codex-main.zip` provides only candidate clues |
| DATA / Candidate mapping review | Gaia `019f3d0b-38ca-7280-acd4-a76bd8bec8d4` | read_only | completed BLOCK | Confirmed seven mappings remain candidate-only and full live SQL query pack must stay blocked |
| QA / Phase 5R acceptance review | Verity `019f3d0b-4d36-7211-8d12-5757b03ee228` | read_only | completed PASS for docs, BLOCK for release gate | Confirmed the plan does not authorize `db pull`, `migration repair`, live query pack, deploy, or Phase 6 |
| PROJECT / Extended archive and session search | Scout the 4th `019f3d0b-cb51-7771-bfe9-f54c55804855` | read_only | completed | Searched visible iCloud, Volumes, developer backup/cache paths, and `.codex` evidence; no exact SQL entity recovered; found seven path/name clues only |
| DATA / Remediation package review | Index `019f3ddf-34b5-7bb0-ab0f-abfd4795ec43` | read_only | completed CONDITIONAL | Approved Owner path choice after clarifying local-only queue, `20260611143348`, and linked dry-run blockers |
| SEC / Remediation package review | Sentinel `019f3ddf-35dd-7d92-af9e-89a5d196f90c` | read_only | completed CONDITIONAL | Required wording that a plan alone cannot unblock live verification and clarified storage path evidence rules |
| QA / Remediation package review | Probe `019f3ddf-36ae-7372-afd2-000474233ff5` | read_only | completed CONDITIONAL | Required `db pull` no-go consistency, split exit criteria, unresolved owner default, and list renumbering |

### Current Deliverable

- Read-only verification package created and strengthened:
  - `docs/SHARED_DB_TENANT_PHASE5_VERIFICATION_RUNBOOK.md`
  - `docs/SHARED_DB_TENANT_PHASE5_APPROVAL_PACKET.md`
  - `docs/SHARED_DB_TENANT_PHASE5_QUERY_PACK.md`
- Runbook now includes Supabase official-reference basis, linked CLI dry-run preflight, migration inventory template/history proof, approval-only draft exclusion proof, attachment constraint validation, same-store index checks, security-definer/public-view checks, storage object prefix counts, non-service RLS/Storage behavior smokes, service-role repository release matrix, onboarding direct-write protection checks, invite-attempt PII/retention checks, audit key-only scan and actor-email retention counts, active-store owner invariant, control-plane RLS/grants, Realtime private broadcast checks, default master-data completeness checks, Vercel release sequence, and Phase 6 entry gate.
- Final hardening pass added expected table/column presence checks that detect missing tables, full store-scoped default-store residue counts, explicit same-store FK matrix validation, counts-only storage object parity checks, sequence/routine grant checks with public/anon/authenticated detection, control-plane owner/invite invariants, query-pack audit metadata, backup artifact/restore/RPO/RTO proof requirements, operational owners, and observation metrics.
- Final documentation pass aligned Phase 5 status wording, real table names (`devices` instead of the stale customer-device alias), payment isolation scope (`repair_orders` fields, no standalone `payments` table yet), control-plane `platform_admins`, and the Owner approval checklist.
- Approval packet now separates the Owner decision from execution, defines allowed read-only actions, explicit no-go actions, operational roles, evidence redaction rules, and the Phase 6 entry gate.
- Query pack index now orders the runbook checks, defines evidence fields, pass thresholds, and stop conditions without duplicating raw production outputs.
- Data/security re-review added hash capture, an executable block manifest, Realtime migration verification, workflow status/transition constraint checks, offline draft object absence checks, and clearer read-only Owner approval wording.
- QA re-review tightened the approval record template, marked the early Phase 5 planning evidence as historical, and confirmed no production mutation/deploy/Phase 6 action is authorized by the current package.
- Phase 5R reconciliation plan added at `docs/SHARED_DB_TENANT_PHASE5R_MIGRATION_RECONCILIATION_PLAN.md`.
- Local, sub-agent, post-fetch remote-ref, remote heads/tags, PR-ref, reachable commit, stash/reflog, unreachable blob keyword, visible local archive/source, adjacent clone, old repo, Desktop, Downloads export, home exact filename, and task/global memory searches found no exact migration files/history paths for the seven remote-only versions. All seven now have candidate name mappings to differently timestamped local SQL, but SQL equality is not proven.
- `/Users/kyox215/Downloads/Chinatech-codex-main.zip` is a useful new clue because it contains RepairDesk 202606/202607 migrations and task memory mentioning `20260701214123` as `order_device_unlock_credentials`; however, the actual SQL remains `20260701120000_order_device_unlock_credentials.sql`, so it is not exact SQL evidence.
- Historical task evidence for `customer_interactions_store_id_repair` and `order_device_unlock_credentials` includes pre-apply/superseded timeline notes. Phase 5R treats those files only as name/version clues and production-effect evidence where explicitly recorded, not as byte-for-byte SQL provenance.
- Extended search across visible iCloud, `/Volumes`, common developer backup/cache paths, and `.codex` sessions/memories still found no exact SQL entity. `.codex` sessions provide seven exact remote-version path/name clues, but not the SQL text itself.
- Owner-approved isolated `supabase db pull` review was attempted from `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z` with offline draft migrations excluded. Standard `db pull` was blocked by migration-history mismatch; `db pull --use-pg-delta` failed on `pg_user_mapping` permissions. No migration file was generated.
- Fallback public schema-only dump was captured at `/private/tmp/repairdesk-phase5r-db-pull-20260707T1820Z/phase5r_public_schema_dump.sql` with SHA256 `738d76455d08c821d4c27808f93d87748fab588098d824127650b2e96a91f39b`. It is useful for schema-shape review but does not recover exact historical SQL.
- Phase 5R remediation package added at `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md`. It defines Option A exact SQL recovery, Option B documented reconstruction design, Option C high-risk metadata-only repair package, and Option D freeze. It does not authorize any remote or production action.
- The remediation package carries forward the seven candidate mappings and opens a local-only migration classification queue. `20260704221944_store_invite_links.sql` is flagged because the fallback public schema dump did not contain `store_invite_links`.
- Current release status: Phase 5 full live SQL verification is no-go until migration history is reconciled through executed remediation, the history state is trusted, DATA/SEC/QA/RELEASE sign-off exists, and the Owner separately approves the specific read-only command set. Production migration, schema-cache reload, Vercel promote, and Phase 6 global rollout remain no-go.

### Next Required Owner Decision

Before the full live SQL query pack can run:

1. Use the completed DATA, SEC, and QA conditional reviews of `docs/SHARED_DB_TENANT_PHASE5R_REMEDIATION_PACKAGE.md` as the current decision packet.
2. Choose Option A exact SQL recovery, Option B documented reconstruction design, Option C metadata-only repair package, or Option D freeze.
3. Decide whether reconstructed local files may be created in an isolated review branch/worktree. This is not production execution.
4. Decide whether any future `supabase db pull` review is allowed. Default remains no.
5. Decide whether any `supabase migration repair` command is allowed. Default remains no.
6. Decide whether `store_invite_links` is intended as a forward migration candidate, because the live public schema dump did not contain it.
7. Decide which local-only migrations are intended for production and which remain draft/excluded.
8. Keep offline-sync draft migrations excluded unless separately approved.
9. Only after separate Owner approval, re-run `supabase migration list --linked` and `supabase db push --linked --dry-run`.
10. Continue to the live read-only SQL query pack only after CLI preflight passes following executed remediation, or after every exception has an executed and reviewed Owner-approved remediation outcome plus separate Owner approval for the specific read-only command set.

Recommended Owner choice for the next stage: Option A remains preferred if a new external source can be supplied. Otherwise use Option B to create a read-only documented reconstruction design package, while keeping `db pull`, `migration repair`, linked apply, full live SQL query pack, deploy, and Phase 6 blocked.
