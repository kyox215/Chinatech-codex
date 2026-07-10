# Execution Plan — Security and Reliability Hardening Release

Status: approved for bounded execution by the Owner's 2026-07-10 instruction.
Risk: R4.
Decision owner / integration writer: main Codex thread.
Production/database operator: main thread only after gates.

## Architecture decision

Keep the existing Next.js BFF + Supabase modular monolith. Strengthen the current
authorization, validation, repository and transaction boundaries. Do not create a
new service or expose Service Role access to the browser.

## Phase A — non-database correctness

### WP-01 Customer read authorization

- Add explicit `customer:list` and `customer:detail` asserts at all six read routes.
- Follow the approved matrix: owner/manager/sales allow; technician/viewer are scoped and therefore fail closed until a real object-scope resolver exists.
- Preserve same-store repository filters.
- Add helper-level role tests and route behavior tests proving service functions are not called on denial.

Exit: forbidden roles receive 403 before any customer repository call; allowed roles remain compatible.

### WP-02 Auth and runtime validation

- Remove `user_metadata.email_verified` from JWT and admin-user fallbacks.
- Retain canonical confirmed fields and server-controlled app metadata only where current Supabase semantics support them.
- Replace three string casts with real runtime enum schemas sourced from canonical enum constants.
- Add complete valid-payload negative tests so failures prove the intended field.

Exit: forged metadata and invalid enums fail; valid existing payloads pass.

### WP-03 Pagination correctness

- Orders: use stable `updated_at desc, id asc` batches for every branch, then preserve the existing business-workflow ordering before slicing.
- Search/overdue and normal paths share the correct paged-all bridge; document the O(N) performance limitation and defer true SQL business-order pagination.
- Inventory: replace fixed `.limit(1000)` with deterministic chunk pagination so list/stats are complete without a UI contract break.
- Customer legacy fallback: page customers/devices instead of silently truncating; keep the primary v2 RPC.

Exit: mocked 1001+ datasets remain complete and page 2 returns real rows.

### WP-04 Admin-script safety

- Require explicit project ref and store ID.
- Derive and compare the project ref from the target URL without printing keys.
- Default to dry-run; production-impacting mode requires a target-specific confirmation phrase.
- SeaTable backup and deletes must be store-scoped; no default `/tmp` for apply.
- Seed/reset must carry the same environment/target gate.
- Unit-test pure argument/target validation helpers without connecting to Supabase.

Exit: wrong/missing target cannot mutate; no all-tenant delete path remains in ordinary scripts.

### WP-05 E2E credibility

- Use one consistent hostname for Playwright base URL and Next request origin.
- CI must not reuse an arbitrary existing server.
- Strict business specs must fail on login or business-load errors.
- Artifacts use Playwright output paths; tracked evidence is copied only during explicit closeout.

Exit: strict desktop business suite executes rather than skips and passes against controlled mock data.

## Phase B — additive database reliability

### WP-06 Payment command

- Add immutable payment ledger with operation/idempotency ID and same-store FK.
- Add one server-only Postgres function that locks the order, checks store/version/balance,
  updates payment state, inserts ledger and timeline event in one transaction, and returns the result.
- Use security-invoker where service-role privileges are sufficient; use empty/fixed search path,
  fully-qualified relations, revoke PUBLIC/anon/authenticated and grant service_role only.
- Repository calls the function and maps stable result codes. A rollout-compatible fallback is permitted only for missing-function/schema-cache errors and is removed in a later verified task.
- The API keeps stale browser bundles compatible by accepting a missing client key and creating a server UUID; new clients still reuse their key across network retries.

Exit: duplicate operation ID is idempotent; stale version/overpayment do not change any row; event and ledger cannot separate from balance update.

### WP-07 Invite/order commands

- Invite-link claim + invitation insert is implemented only if the DATA/SEC design can preserve current race behavior in one bounded function.
- Full order creation RPC is not promoted from the offline draft unless linked object state and contract tests prove it safe; otherwise record it as the next migration task.

Exit: no large unreviewed draft RPC is silently activated.

### WP-08 Unlock credentials

- Search for an existing approved retention/key-management decision.
- If absent, do not add home-grown encryption, place a key in the database, or purge historical values.
- Implement only independently reviewed non-destructive controls; produce a focused Owner decision package for the remaining vault/retention choice.

Exit: no false claim that plaintext-at-rest is solved without real key separation.

## Verification matrix

| Area | Narrow verification | Release gate |
|---|---|---|
| Permission | router/permission tests for five roles and six endpoints | unauthorized call never reaches repository |
| Auth | forged `user_metadata`, canonical confirmation, fallback tests | no mutable metadata grants access |
| Schema | valid payload + one-field-invalid tables | all canonical enum values accepted, unknown rejected |
| Pagination | 1001+, page boundary, stable ordering tests | no silent truncation |
| Scripts | pure safety helper tests and dry-run subprocess smoke | no connection/mutation without exact target gate |
| Payment | local DB function tests and repository adapter tests | atomic + idempotent + same-store |
| Migration | local reset/list/advisors; linked list/dry-run | exact expected pending only |
| App | lint, typecheck, full test, build, strict E2E | all required gates PASS |
| Release | push evidence, post-apply catalog/query, smoke | no new 4xx/5xx business error and data invariants hold |

## Database no-go conditions

- Linked target cannot be positively identified.
- Local/remote history diverges or requires `migration repair`.
- Dry-run includes any migration outside the reviewed pending set.
- SQL contains unapproved delete/drop/contract/backfill or exposes a function to PUBLIC/anon/authenticated.
- Backup/recovery state cannot be established for the target.
- Local migration reset/function tests fail.
- Production data correction or secret is required.
- Any public business/legacy table has RLS disabled while `anon` or `authenticated` retains direct data privileges.

## Rollback / forward-fix

- Code changes are isolated commits and can be reverted.
- Database changes are additive. On code rollback, new tables/functions remain unused.
- Do not drop a newly applied table/function during the same release; disable its caller and create a reviewed forward migration if correction is needed.
- Payment ledger rows are immutable business evidence and are never deleted as rollback.
