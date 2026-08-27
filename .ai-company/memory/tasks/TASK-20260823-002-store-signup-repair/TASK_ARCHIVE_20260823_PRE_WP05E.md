<!--
Archive snapshot for TASK-20260823-002-store-signup-repair.
The following body is the pre-size-correction TASK.md snapshot, preserved mechanically.
Superseded planning/history remains available here; the live TASK.md is the compact current contract.
-->
---
schema_version: 1
task_id: "TASK-20260823-002-store-signup-repair"
title: "修复 RepairDesk 店铺注册失败并完成安全发布"
status: "in_progress"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
decision_owner: "CEO-Orchestrator / RepairDesk Integration Lead"
departments: ["API", "DATA", "DOC", "INT", "QA", "SEC", "RELEASE"]
created_at: "2026-08-23T14:03:52Z"
updated_at: "2026-08-23T15:49:39Z"
---
# Task — 修复 RepairDesk 店铺注册失败并完成安全发布

## Owner request and approval interpretation

Owner request: “按照规划设定目标并开始完整的修复”。本任务因此从上一轮只读诊断进入 R3 实现、验证和发布准备阶段。

This instruction authorizes the bounded implementation/test work and a reversible forward release plan after all gates. It does **not** authorize reading or exposing secret values, replaying historical POSTs, creating or deleting a real production store/account, destructive cleanup, direct production SQL, migration application, deployment, or public/customer communication before the required Owner/DATA/SEC/QA/Release gates are recorded.

## Business value

Restore self-service creation of an independent store while preserving tenant isolation, service-role-only execution, atomicity, idempotency, rate limiting, safe error handling, observability, and a reversible production release.

## Verified baseline (from TASK-20260823-001)

- Four reported production create-store attempts reached the BFF and returned HTTP 400; paired Supabase RPC calls returned 403 and Postgres recorded `STORE_CREATE_FORBIDDEN`. Signup, verification, PKCE, profile, membership, and onboarding reads succeeded.
- The live RPC and local `supabase/migrations/20260724114500_atomic_store_onboarding.sql:54-56` contain the legacy `current_setting('request.jwt.claim.role', true)` gate before validation and DML. The ACL in `:240-245` is service-role-only, so the call reached the function body and failed at the redundant claim check.
- No known `store_creation_operations` row or normalized `Oriente Tech` store row was created by the reported failures.
- The application currently passes an opaque server key under the legacy environment-variable name, drops `STORE_CREATE_FORBIDDEN` in `src/features/stores/server/store.repository.ts:144-182`, maps ordinary errors to HTTP 400 in `src/server/api/repairdesk-router.ts:1373-1424`, and presents a generic retry toast in `src/features/auth/screens/onboarding-screen.tsx:93-110`.
- Existing pgTAP success setup manually sets the legacy claim (`supabase/tests/atomic_store_onboarding.sql:95-109`), while the browser E2E mocks the create route (`tests/e2e/atomic-store-onboarding.spec.ts:18-77`). Neither proves a real no-claim service-role mutation.

## Facts, inferences, and unknowns

| Item | Type | Evidence | Status / action |
|---|---|---|---|
| Legacy claim gate is the direct availability blocker | confirmed | Audit E-007; migration `20260724114500:54-56` | Remove only this gate in a new forward migration; preserve all other function behavior. |
| RPC is intended to be callable only by `service_role` | confirmed | Audit E-007/E-010; migration ACL `:240-245` | Re-assert `REVOKE` from `PUBLIC`, `anon`, `authenticated` and `GRANT EXECUTE` to `service_role`. |
| `SECURITY DEFINER` and empty `search_path` are required | confirmed | migration function definition | Static and database assertions must remain in the new migration. |
| Store creation must remain one transaction | confirmed | migration function body and audit E-007 | No table/column/index/data/backfill changes; child failures must leave no residue. |
| New Supabase secret keys are elevated backend-only keys mapped to the built-in `service_role` role; legacy `service_role` keys remain concurrently supported | confirmed external documentation | [Supabase Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys), fetched 2026-08-23 | Use only to design compatibility; do not copy or record any key value. |
| Production key category/value | unknown by design | Audit E-011; no secret access authorized | Verify only through safe non-secret category metadata or controlled test configuration; never read into task memory. |
| Exact deployed source parity and recovery-point readiness | unknown | Audit E-011; deployment commit unavailable locally; shared tree is dirty/diverged | Clean-lineage isolated worktree, backup/PITR evidence, and exact migration lineage are release blockers. |
| Production baseline metadata | supplied context, not independently re-verified in this intake | Deployment baseline commit `7b47c0afcb2bea5f1069553555c701bc75549d46`; current live migration marker `20260810173610` | WP-00 must re-fetch/verify exact deployed source, live function definition, and migration parity before any release claim. These identifiers do not authorize migration or deploy. |
| Whether a production migration/deploy has happened in this task | not yet | Current task checkpoint and worktree | No production claim until release evidence is collected and Owner approves. |

## Scope in

1. Create one additive forward migration that removes only the redundant `request.jwt.claim.role` gate from the existing atomic store-create RPC. Preserve the exact signature, `SECURITY DEFINER`, `set search_path = ''`, input/verified-email checks, advisory lock, idempotency/conflict behavior, rate limit, all DML, child-row rollback, and return shape.
2. Make the server admin client accept the new backend secret-key environment variable with a legacy `SUPABASE_SERVICE_ROLE_KEY` fallback, without logging or exposing either value; preserve server-only use.
3. Preserve the BFF actor and verified-email checks, map the stable backend configuration/auth failure to a typed HTTP 503 with a safe correlation/request ID, and provide an actionable onboarding message containing only the ID and retry guidance.
4. Add regression coverage for service-role/no-claim, new secret and legacy service-role PostgREST success, browser-role execute denial, negative roles, unverified email, invalid input, rate limiting, idempotent replay/conflict, child-write rollback, typed 503/correlation mapping, UI retry/request-ID behavior, and one gated isolated/staging real-PostgREST E2E that does not mock the create route.
5. Update the scoped store-signup release/runbook documentation and task evidence; include migration dry-run/parity, observability, canary, rollback, and stop conditions.

## Scope out / forbidden

- Do not edit or rewrite historical migration `20260724114500_atomic_store_onboarding.sql`.
- Do not alter tables, columns, indexes, RLS policies, tenant predicates, operation-ledger retention/FK policy, `store_code` uniqueness, purge migration GUC checks, or unrelated onboarding flows.
- Do not replace the layered BFF/auth/email checks with `current_user = 'service_role'` inside the definer function, nor expose the RPC to browser roles.
- Do not access, print, commit, screenshot, or persist any secret, token, session, full customer PII, or production payload.
- Do not automatically replay the four historical failed POSTs, create/delete a real store, purge data, run destructive SQL, or deploy/migrate production without the release approval record.
- Do not reformat or revert unrelated dirty-worktree files; current shared tree is not a valid business-code write location.

## Change budget and future code-path ownership

The following is the maximum implementation budget. A single Luna business writer must own the code paths in an isolated clean worktree; reviewers remain read-only.

| Owner | Exact path / symbol boundary | Allowed change | Explicit no-go |
|---|---|---|---|
| DATA/API writer | `supabase/migrations/<new-forward-store-create-migration>.sql` (one new file; timestamp assigned only after clean-lineage check) | Same-signature `CREATE OR REPLACE`, delete only legacy claim gate, re-assert exact ACL, schema reload; no schema/data changes | Historical migration edits, grants to browser roles, table/backfill changes |
| API writer | `src/server/supabase.ts` (`hasSupabaseConfig`, `getSupabaseAdmin`) | Resolve `SUPABASE_SECRET_KEY` first with `SUPABASE_SERVICE_ROLE_KEY` fallback; keep URL fallback and server-only error; never log values | Client exposure, broad env renaming, unrelated server clients |
| API writer | `src/features/stores/server/store.repository.ts` (`createStore`, `mapStoreCreateError`, typed store-create unavailable error) | Preserve actor/email checks and payload; map only the infrastructure/config failure to safe 503-compatible domain error; retain stable public messages for validation/rate/idempotency | Changing transaction semantics, tenant rules, or raw DB error exposure |
| API/INT writer | `src/server/api/repairdesk-router.ts` (`fail`, `stores/create` case, correlation helper) and, if needed, `src/app/api/repairdesk/[...path]/route.ts` | Emit safe `{ error, code, requestId }` for this failure and keep no-store/private headers; correlation ID must not contain secrets/PII | Global error-contract rewrite, status changes for unrelated routes |
| FE/API writer | `src/lib/repairdesk/api.ts` (`RepairDeskApiError`, response decoding) and `src/features/auth/screens/onboarding-screen.tsx` create mutation | Preserve request ID, show actionable retry/service-unavailable copy, reset request ID only on conflict, keep same-request replay semantics | New auth flow, direct Supabase client calls, optimistic store state |
| QA/DATA writer | `supabase/tests/atomic_store_onboarding.sql`, `src/features/stores/server/store.repository.test.ts`, `src/server/api/repairdesk-router.test.ts` or a single scoped store-create route test, `src/server/supabase.test.ts` (new if needed), `tests/e2e/atomic-store-onboarding.spec.ts`, and one gated real-PostgREST E2E file | Add the required regression and contract tests; use synthetic IDs/data and environment gates | Tests that read production secrets/data, mock away the only real mutation proof, or weaken existing assertions |
| DOC writer | `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` (new scoped runbook) and task-memory files | Document preflight, migration, canary, observability, rollback, and no-replay rules | Storing secrets, claiming release before evidence |
| Same Luna writer — reviewer-triggered R3 correction batch | `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` (new inert artifact), `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `src/server/api/repairdesk-router.test.ts`, `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` | Add the minimum DATA/SEC/RELEASE corrections: an inert, non-auto-applied rollback artifact that exactly restores the prior function gate/ACL/schema reload for staging forward→rollback→forward rehearsal; harden the real-PostgREST E2E, invalid-UUID router assertions and runbook safety/observation controls | No production domain/project ref, no production secret/data, no automatic SQL apply, no real production POST/store, no trace/screenshot/video artifacts, no unrelated code/path expansion, no separate writer |

Any extra path requires an updated contract and Integration Lead approval. No code writer may stage, commit, push, migrate, deploy, or close the task.

### Reviewer-triggered minimum R3 correction batch (pending; not a repair claim)

The DATA/SEC/RELEASE review findings trigger one bounded correction batch before the task can advance to a release-ready review. The same Luna business writer may apply it only in the already-authorized isolated worktree, with the exact four-path allowlist above; reviewers remain read-only. This correction batch does not change the production NO-GO boundary and does not mean the findings are already fixed.

- `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` must be inert/documentation-only and must never auto-apply. It must encode the exact prior function gate, exact prior ACL (`PUBLIC`/`anon`/`authenticated` revoked; `service_role` grant) and schema reload step needed to restore the pre-forward definition for a staging-only forward→rollback→forward rehearsal. The artifact must carry a deterministic hash in the runbook/evidence after generation; no production execution is permitted.
- `tests/e2e/atomic-store-onboarding-postgrest.spec.ts` must hard-fail when the target host is a production domain or the project ref is production, require an explicit non-production allowlist, validate external state storage/domain with mode `0600`, disable trace/screenshot/video capture, and wait for a real POST 2xx before treating the flow as successful. It must not read or print secrets or customer data.
- `src/server/api/repairdesk-router.test.ts` must assert that invalid UUID input never appears in the response body, logs or correlation output while preserving the safe typed error contract.
- `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` must add branch TTL, cost ceiling, destroy owner, rollback-artifact hash and forward→rollback→forward rehearsal evidence, backup/PITR residual status, and explicit 15/30/60-minute observation thresholds/stop conditions.
- Correction acceptance is pending implementation plus DATA/SEC/QA/RELEASE review. Until those artifacts and review evidence exist, no test/review plan may be described as fixed, and WP-06 production migration/deploy/canary remains NO-GO.

## Work packages and dependencies

### WP-00 — Contract and clean-lineage preflight

- Owner: INT / Integration Lead; Approver: Owner.
- Inputs: prior audit E-005–E-012, current task packet v1, dirty-worktree status.
- Deliverables: clean isolated worktree, exact deployed lineage, non-secret function/ACL/proconfig/invariant snapshots, backup/PITR readiness evidence.
- Depends on: current task contract; no business write in shared worktree.
- Exit: lineage and recovery evidence are reproducible, or task is blocked without code changes.

### WP-01 — Minimal database forward migration

- Owner: DATA/API single writer; Reviewers: DATA + SEC.
- Depends on WP-00.
- Deliverables: one additive migration with only the gate removal and ACL/schema assertions; local SQL/static proof and linked dry-run.
- Exit: function signature/body invariants, grants, definer/search path, and no schema/data drift are proven.

### WP-02 — Server compatibility and typed observability

- Owner: API single writer; Reviewer: SEC.
- Depends on WP-01 design only; implementation can be developed in parallel in the isolated worktree.
- Deliverables: new-secret/legacy fallback, safe typed 503 and correlation ID, no secret/PII logs, unchanged actor/email/tenant checks.
- Exit: unit/route tests prove stable code/status/request-ID behavior and safe failure mapping.

### WP-03 — UI and client error contract

- Owner: API/FE single writer; Reviewer: QA.
- Depends on WP-02 response contract.
- Deliverables: actionable retry/service-unavailable message, request-ID display, same request ID on safe retry, no duplicate-success transition.
- Exit: focused UI test/E2E assertions pass at mobile and desktop target widths where applicable.

### WP-04 — Real mutation and rollback regression suite

- Owner: QA/DATA; Reviewers: QA + DATA + SEC.
- Depends on WP-01–WP-03.
- Deliverables: real service-role/no-claim and both key modes in isolated/staging PostgREST, browser-role denial, negative roles, validation/rate/idempotency/rollback cases, no residue checks.
- Exit: no mocked-only evidence remains for the critical success path; failures are actionable and reproducible.

### WP-05 — Documentation and release package

- Owner: DOC + RELEASE; Approvers: Owner + DATA/SEC/QA/Release.
- Depends on WP-01–WP-04.
- Deliverables: runbook, migration lineage/parity report, observability dashboard/queries, canary and rollback commands, approval record.
- Exit: all release gates are signed or the task remains `review`/`blocked`; no production action is implied by a passing local suite.

### WP-05C — Reviewer-triggered R3 correction batch

- Owner: same Luna business writer in the isolated worktree; Reviewers: DATA + SEC + QA + RELEASE.
- Trigger: reviewer findings E-013; this is a minimal correction, not a new feature or production approval.
- Exact paths: `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql`, `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `src/server/api/repairdesk-router.test.ts`, `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`.
- Exit: rollback artifact hash recorded; staging-only forward→rollback→forward rehearsal evidence exists; E2E rejects production host/ref and validates non-prod allowlist/0600 external state/no media capture/real POST 2xx; router invalid UUID is non-disclosing; runbook contains TTL/cost/destroy-owner/backup-PITR/observation controls; reviewers sign or leave the task in `review`/`blocked`.
- No-go: no SQL auto-apply, production domain/project ref, secret/PII access, production POST/store, deploy/migrate, `.env.example` modification, or unrelated path changes; environment handling may be described in the runbook only.

### WP-05D — v3 reviewer correction contract (pending; production NO-GO)

- **Trigger:** the 2026-08-23T15:16:36Z v3 DATA/SEC/QA/Release review found WP-05C not locally releasable: the runner-declared Supabase ref was not bound to the actual BFF, final page/POST origin and storage-state checks were incomplete, the rollback drill reused an already-applied migration version, and one observation threshold lacked a valid baseline.
- **Writer/worktree:** keep `in_progress`, R3/L2 and production NO-GO; use the same Luna writer and same isolated worktree. WP-05D write paths are only `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `src/server/api/repairdesk-router.test.ts`, and `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. The existing `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` is read-only in WP-05D; do not change its SQL. If a hash reference must change, update only the hash text in the runbook/evidence after re-verification.
- **A — real mutation E2E attestation:** the Playwright test must run with `REUSE_EXISTING_SERVER=0`, start a fixed Node 24 loopback release server using an exact recorded command and fixed base origin, and use the same process-inherited allowlisted non-production branch ref for the BFF and Supabase client. Require `SUPABASE_URL === NEXT_PUBLIC_SUPABASE_URL`; hard-fail production hosts/project refs; require an explicit non-production allowlist; validate a fixed repo-root, regular non-symlink, owner-matched `0600` storageState and pre-resolved cookie/origins; require final `goto` origin and POST origin to match; wait for a real POST 2xx and assert exact UUID and name. Keep Vercel Node 24 preview build/smoke separate from real mutation E2E, and ensure preview cannot connect to production.
- **B — router contract:** `src/server/api/repairdesk-router.test.ts` must exercise the real `handleRepairDeskPost('stores/create', invalid body, actor)` path, assert HTTP 400, and prove the invalid ID is absent from response body, headers and logs/correlation output. Retain the fixed-code helper invalid-UUID test as a complementary unit assertion.
- **C — rollback and observation:** the staging rehearsal must use a fresh re-forward migration created after rollback and later than already-applied `20260823141758`; never reuse that applied migration version. Enumerate five invariants and prove each has violation count 0 after forward, rollback and re-forward. Prove rollback does not delete valid store rows, child rows or operation ledger rows. Replace the invalid p95 baseline with absolute 30-minute thresholds: exactly 1 successful mutation, completion ≤10 seconds, and 0 timeouts, 503s or 5xx responses; any violation stops the rehearsal.
- **Hard no-go:** no backend endpoint or production-source expansion, no `.env.example`, no migration/DB/secret/deploy action, no production host/ref, no reuse of an existing server, no trace/screenshot/video artifacts, no real production POST/store, and no claim that WP-05D is fixed until focused tests and DATA/SEC/QA/Release re-review pass.
- **Exit:** record exact loopback command/base origin, inherited branch-ref binding, storageState/domain mode checks, exact UUID/name, 2xx evidence, router non-disclosure evidence, fresh re-forward migration identity, five-invariant 0/0/0 results, rollback preservation evidence, absolute 30-minute observations and reviewer verdicts. Otherwise keep `review`/`blocked` and production NO-GO.

### WP-05E — SEC v4 prelaunch-order correction contract (pending; production NO-GO)

- **Trigger:** the 2026-08-23T15:49:09Z SEC v4 review found a High prelaunch-order blocker: Playwright `webServer`/plugin setup may execute before sensitive spec top-level guards. Current credential-bearing execution is forbidden until configuration-load guards run first.
- **Writer/worktree/state:** keep `in_progress`, R3/L2 and production NO-GO; use the same Luna writer in the same isolated worktree. WP-05E write allowlist is exactly: `playwright.config.ts` (only early sensitive-flag refusal and dedicated-config pointer), new `playwright.store-signup-postgrest.config.ts`, new `tests/e2e/support/atomic-store-onboarding-postgrest-env.ts`, `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, and `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. All other files are forbidden. `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` remains read-only; no hash or SQL change is authorized by WP-05E.
- **Shared guard / no duplication:** `tests/e2e/support/atomic-store-onboarding-postgrest-env.ts` must provide one shared guard. The dedicated config must load and execute it before `defineConfig`; the spec must reuse it as a second defense and retain exact origin/POST/UUID/name assertions. The guard must fail closed at module/config load for Node 24, `requested=1`, exact loopback/base/command/`REUSE_EXISTING_SERVER=0`, `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` equality and ref binding, key mode, and every existing storageState/domain/non-production gate.
- **Dedicated config contract:** `playwright.store-signup-postgrest.config.ts` must hardcode `testMatch`, `workers: 1`, list reporter with no HTML reporter, validated storageState, `trace: off`, `screenshot: off`, `video: off`, and `webServer` command/url with `reuseExistingServer: false`. It must not inherit permissive global webServer/plugin behavior.
- **Default config refusal:** `playwright.config.ts` must inspect the sensitive flag during config load and, before any webServer or plugin setup, throw a safe refusal pointing to `--config=playwright.store-signup-postgrest.config.ts`. A default-config run with a malicious marker command must fail before command start and leave no marker.
- **Negative/positive matrix:** prove dedicated Node 20 fails before server start; synthetic Node 24 secret-key and legacy-key mode lists reach test discovery without exposing values; all negative guards fail closed. Keep Vercel Node 24 preview build/smoke separate and production-inaccessible from real mutation E2E.
- **Runbook command:** `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` may document only `--config=playwright.store-signup-postgrest.config.ts` for the sensitive E2E and must state that ordinary/default config refuses it. No `.env.example` change is permitted.
- **Hard no-go/exit:** no backend endpoint or production-source expansion, migration/DB/secret/deploy, production host/ref, real production POST/store, trace/screenshot/video artifacts, or unlisted file. Acceptance requires prelaunch negative proofs, synthetic Node24 discovery for both key modes, dedicated-config hardening and SEC/QA/Release re-review; until then WP-05E is not fixed and WP-06 remains blocked.

### WP-06 — Controlled production release and observation (separate D4 gate)

- Owner: Integration Lead / Release; Approver: Owner.
- Depends on WP-05 and explicit production approval.
- Deliverables: forward migration/deploy evidence, smoke result, 15/30/60-minute observation, final invariants and support note.
- Exit: only after zero stop conditions during observation; otherwise rollback/blocked.

## Evidence and acceptance matrix

| Acceptance | Required evidence | Owner | Gate |
|---|---|---|---|
| New secret and legacy service-role both create via real PostgREST | Redacted environment-category record plus isolated/staging HTTP/RPC responses and invariant query; no key values | DATA/API/QA | WP-04 |
| No legacy claim dependency | Migration diff/static assertion plus no-claim service-role test and `pg_get_functiondef`/ACL proof | DATA/SEC | WP-01/WP-04 |
| Browser roles remain denied | `has_function_privilege` for `PUBLIC`/`anon`/`authenticated` and direct-call denial with zero residue | DATA/SEC/QA | WP-01/WP-04 |
| Auth, email, validation, rate-limit and tenant safety remain fail-closed | Unit/integration/SQL tests and reviewer report | API/SEC/QA | WP-02/WP-04 |
| Atomicity/idempotency | Same-request replay returns original store, hash conflict rejects, child FK failure leaves zero store/ledger/child residue | DATA/QA | WP-04 |
| Typed 503/correlation observability | Route test with safe code/status/request ID; log-schema assertion excluding secrets/PII | API/SEC/QA | WP-02/WP-03 |
| UI actionable recovery | Onboarding test/E2E sees service-unavailable copy and request ID; safe retry preserves request ID | FE/QA | WP-03 |
| Release safety | Clean lineage, linked dry-run/parity, backup/PITR check, approvals, canary and 15/30/60-minute observations | RELEASE/INT/Owner | WP-05/WP-06 |
| Reviewer-triggered correction safety | Inert rollback artifact hash + staging forward→rollback→forward rehearsal; E2E production hard-stop/non-prod allowlist/0600 state/no media/real POST 2xx; invalid UUID non-disclosure; runbook TTL/cost/destroy-owner/backup-PITR/15/30/60 thresholds | DATA/SEC/QA/RELEASE | WP-05C; pending |
| v3 reviewer correction attestation | `REUSE_EXISTING_SERVER=0` fixed Node 24 loopback release server with exact command/base origin; BFF/client same allowlisted non-prod branch ref and `SUPABASE_URL===NEXT_PUBLIC_SUPABASE_URL`; fixed-root regular non-symlink owner-matched 0600 state/cookie/origins; final goto/POST origin equality; real 2xx + exact UUID/name; Vercel preview build/smoke isolated from mutation E2E | DATA/SEC/QA/RELEASE | WP-05D; pending |
| v3 router/rollback/observation correction | Real `handleRepairDeskPost` invalid-body 400 with invalid UUID absent from body/headers/logs plus helper test; fresh post-rollback re-forward migration later than `20260823141758`; five invariants 0/0/0 and valid rows preserved; absolute 30-minute threshold exactly 1 success, ≤10s, 0 timeout/503/5xx | API/DATA/SEC/QA/RELEASE | WP-05D; pending |
| SEC v4 prelaunch-order correction | Shared guard executes before dedicated `defineConfig`; default config early-refuses sensitive flag before webServer/plugin setup; dedicated config hardcodes testMatch/workers/list reporter/no HTML/storageState/trace-screenshot-video off/webServer command-url/reuse=false; Node20 fails prelaunch and synthetic Node24 secret/legacy modes reach discovery; default malicious marker never starts | SEC/QA/RELEASE | WP-05E; pending |

## Rollback and stop conditions

### Rollback

- Prefer a forward rollback migration that restores the prior function definition and exact ACL; this is fail-closed and may temporarily block registration, but it does not edit history or delete valid rows.
- If an urgent permission stop is required, revoke `service_role` EXECUTE as an explicitly approved emergency action, then restore only through a reviewed forward migration.
- Never delete valid stores, clear `store_creation_operations`, replay old POSTs automatically, or alter unrelated tenant data.
- Application rollback returns the typed error mapping/client copy to the last known compatible version only after checking migration compatibility; migration and app rollback order must be recorded in the runbook.

### Immediate stop / no-go

- Any unexpected grant to `PUBLIC`, `anon`, or `authenticated`; missing `service_role` grant; changed signature; non-empty search path; removed security-definer; or altered validation/atomic/idempotency/rate-limit logic.
- Any cross-tenant read/write, unverified-email success, negative-role success, duplicate/orphan row, partial child write, or raw secret/PII in response/logs.
- Any `STORE_CREATE_FORBIDDEN`, unexpected 5xx/4xx increase, latency/error-budget breach, schema/migration parity mismatch, unavailable backup/PITR, or unverified deployed lineage.
- Any request to inspect a production secret, replay historical POSTs, create/delete a real production store, or run destructive SQL without a new Owner decision and matching packet.
- Shared worktree remains dirty/diverged, or an implementation change would overlap unowned files.

## Release approval record

- Current state: **implementation approved to begin; production release and real production canary not yet approved**.
- Baseline to verify before release: deployment commit `7b47c0afcb2bea5f1069553555c701bc75549d46`; live migration marker `20260810173610`. These are baseline metadata supplied by the Integration Lead, not proof that the current dirty worktree matches production.
- Owner instruction: explicit approval to follow the existing repair plan and begin complete repair (recorded in current task intake; no secret/data authority implied).
- Required before production or a real production canary: clean lineage + recovery evidence; DATA migration review; SEC auth/ACL/log review; QA test/rollback review; Release runbook/canary/observation review; explicit Owner release/canary approval.
- Default if any gate is missing: do not migrate/deploy; keep task `in_progress` or `blocked` with evidence.
- Production migration/deploy approver: Owner / Integration Lead after all independent reviews.
- No automatic replay of the four historical requests.

## Definition of done

- All acceptance rows above have evidence, not intentions.
- Business code, tests, migration, docs and runbook are internally consistent and reviewed.
- Service-role-only ACL, tenant/auth/email gates, atomicity, idempotency, rate limit and safe observability are proven in isolated/staging and, only after approval, production canary.
- Release and rollback evidence, 15/30/60-minute observations, and residual-risk owner/deadline are recorded.
- Task status may advance `in_progress → review → verified → released → closed`; it must not jump directly to closed.
- This intake checkpoint itself is **not** a completion claim, production claim, test pass, migration application, deployment, or screenshot of a successful store creation.
