# Store signup repair runbook

Status: implementation draft. This runbook records the reversible forward repair; it is not an approval to migrate, deploy, or create a production store.

## Baseline and lineage

- Clean implementation baseline: production commit `7b47c0afcb2bea5f1069553555c701bc75549d46`.
- Current live migration marker at planning time: `20260810173610`.
- The historical migration `supabase/migrations/20260724114500_atomic_store_onboarding.sql` is immutable and must remain byte-for-byte unchanged.
- Forward migration: `supabase/migrations/20260823141758_repairdesk_store_create_service_role_compat.sql`.
- Inert rollback artifact: `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql`.
- Rollback artifact SHA-256: `4ee9dae7a6d91cec62d20808c16aa2ca0b74c0f821fa0f71110875c38e4bcc75`.
- Verify the exact commit, migration filename, and migration body in a clean worktree before any linked-environment action. Do not infer lineage from a branch name or local dirty tree.

## What the forward migration changes

The migration replaces the existing `public.repairdesk_create_store_atomic_rpc` with the same signature and the same `SECURITY DEFINER`, empty `search_path`, validation, email check, advisory lock, idempotency, rate limit, DML, transaction, and return shape. It removes only the obsolete `request.jwt.claim.role` gate.

The final ACL is the authority boundary: `PUBLIC`, `anon`, and `authenticated` are explicitly revoked, and `service_role` is granted `EXECUTE`. No table, column, index, RLS policy, backfill, purge, or data-retention change is included. PostgREST schema reload notification is sent after the ACL statements.

Supabase's current API-key guidance describes `sb_secret_...` keys as backend-only elevated keys equivalent to the service-role capability, while legacy `service_role` keys remain supported. The application therefore prefers a non-empty `SUPABASE_SECRET_KEY` and falls back to a non-empty `SUPABASE_SERVICE_ROLE_KEY`; values are never logged, printed, or written to task evidence. See the [official Supabase API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).

## Preconditions and read-only prechecks

Run these checks against the intended non-production or approved release environment, using an operator account that can inspect metadata but not expose key values:

1. Before candidate freeze, create the isolated worktree from the exact baseline above and verify that the historical migration is byte-for-byte unchanged. After candidate freeze, verify that the candidate's merge-base and single parent commit are that baseline, `HEAD` is the recorded and approved candidate SHA, and the candidate worktree is clean; do not require post-freeze `HEAD` to remain at the baseline.
2. Confirm the live migration marker is `20260810173610` (or stop and obtain a new lineage decision if it differs).
3. Inspect the target function's signature, `prosecdef`, `proconfig`/empty `search_path`, and ACL. Do not call the function with customer data or create a store during prechecks.
4. Confirm `PUBLIC`, `anon`, and `authenticated` do not have `EXECUTE`; confirm `service_role` does.
5. Confirm backup/PITR readiness and the restore point for the target environment. Current backup/PITR status is **unknown** and must be resolved before a production gate can pass.
6. Confirm the application environment exposes either a non-empty `SUPABASE_SECRET_KEY` or the legacy fallback without printing the value. Never use a browser key for the server RPC.
7. Supabase Pro's daily backup policy and seven-day retention are confirmed for the account; the exact latest backup timestamp and usable PITR restore point remain **unknown** and are release blockers until verified non-secret metadata is recorded.

## Forward application order

1. Complete independent DATA, SEC, QA, and Release reviews of the migration, repository/router response, client retry behavior, tests, and this runbook.
2. Verify migration lineage and the prechecks above in a clean release worktree.
3. Apply the single forward migration in the approved environment. Do not edit or replay historical migrations.
4. Reload PostgREST schema (the migration emits `pg_notify('pgrst', 'reload schema')`) and perform read-only postchecks for the function definition and ACL.
5. Deploy the server/client changes that use the typed `503 STORE_CREATE_UNAVAILABLE` response. The UI must preserve the same request id for a safe retry and show that id to the operator.
6. Observe error rates, ACL-denial signals, and sanitized availability telemetry (`event`, `status`, `errorCode`, `requestId`) without recording raw Supabase/SQL errors or secrets.

## Staging-only forward → rollback → forward drill

This drill is a release rehearsal only. Do not execute the inert SQL file directly, do not run it against production, and do not promote a staging artifact. A separately reviewed forward migration may copy the exact commented body from `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` only after explicit staging authorization.

1. Create the Supabase disposable staging branch from the verified and approved database baseline/lineage. Independently use a clean Git release worktree whose `HEAD` is the recorded candidate SHA (with its merge-base and single parent still the production baseline); never treat the Git baseline commit as the source of the database branch. Verify the non-production origin/project-ref allowlists, external `storageState` mode `0600`, and the read-only prechecks above.
2. Apply the reviewed forward migration in staging, reload PostgREST, and run the read-only function/ACL/invariant checks plus the gated real E2E. Record the migration response and synthetic `activeStore.id/name`; do not retain customer data.
3. Stop the staging create path, create and apply a newly timestamped reviewed forward rollback migration containing the artifact's exact historic function gate and ACL, reload PostgREST, and confirm the old gate is restored without table/data/policy changes.
4. After rollback, create a fresh, later-timestamped reviewed re-forward migration that copies the forward function body, ACL declarations, and schema reload exactly. It must be newer than the already-applied `20260823141758`; never reuse that migration version. Apply it, rerun the read-only checks and real E2E, and confirm the service-role/no-claim contract. Any mismatch stops the drill.
5. For each stage, record the five **data invariant** violation counts below; every forward, rollback, and re-forward count must be exactly `0`:

   | Data invariant                                             | Forward | Rollback | Re-forward |
   | ---------------------------------------------------------- | ------: | -------: | ---------: |
   | Active store missing its active lifecycle                  |     `0` |      `0` |        `0` |
   | Active store missing its active owner membership           |     `0` |      `0` |        `0` |
   | Per-store settings row count is not exactly `1`            |     `0` |      `0` |        `0` |
   | Enabled default-create status row count is not exactly `1` |     `0` |      `0` |        `0` |
   | Operation ledger references a store that does not exist    |     `0` |      `0` |        `0` |

   Separately record the metadata/behavior checklist—not part of these five data counts—for the exact function signature, `SECURITY DEFINER`, empty `search_path`, email/input validation, advisory lock, rate limit, idempotent replay/conflict behavior, atomic DML/child-row rollback, and return shape. Compare pre/post counts for a valid store, its child rows, and its operation-ledger rows; rollback must preserve all three and must not delete them.

6. Preserve redacted evidence and delete only the disposable branch/worktree after review. Cleanup owner is the Integration Lead; no store, customer, ledger, or production data may be deleted.

The rehearsal branch TTL is at most four hours. Its infrastructure budget is capped at `$0.01344/hour` and approximately `$0.054` total. The owner must destroy the branch before the TTL/cost ceiling; no automatic cleanup or production promotion is allowed.

The real mutation E2E is fail-closed and runs only in one process-bound environment: first build under Node 24, then let Playwright fresh-spawn the isolated release server with `PLAYWRIGHT_REUSE_EXISTING_SERVER=0`, exact `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3123`, and exact `PLAYWRIGHT_WEBSERVER_COMMAND='npm run preview -- -H 127.0.0.1 -p 3123'`. HTTP is limited to that exact loopback origin; remote and Vercel origins are rejected. The server and browser must inherit the same non-production branch ref (`REPAIRDESK_E2E_ATOMIC_ONBOARDING_BRANCH_REF` equals the allowlisted Supabase project ref), and normalized `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` must be identical. Require a non-empty `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` without recording its value. Run two independent credential executions: `REPAIRDESK_E2E_ATOMIC_ONBOARDING_KEY_MODE=secret` permits only a non-empty `SUPABASE_SECRET_KEY`, while `legacy` permits only a non-empty `SUPABASE_SERVICE_ROLE_KEY`; neither value is printed or persisted.

The E2E uses a fixed repository root resolved from `import.meta.url`. Its external storage state is a regular owner-matched file with mode `0600`, no symlink path, no `.git` ancestor, and (when configured) an owner-matched external directory with mode `0700`; JSON is parsed without output, cookies are non-empty and scoped only to `127.0.0.1`, and origins (if present) equal the exact loopback origin. After `page.goto`, the final origin is asserted before interaction; the waiter matches the exact-origin `POST /api/repairdesk/stores/create`, and the response requires a strict UUID `activeStore.id` and exact non-empty synthetic `name`. Trace, screenshot, and video are off; the critical route is never mocked.

The only permitted sensitive mutation-E2E command is `npx playwright test --config=playwright.store-signup-postgrest.config.ts`; run it only after the Node 24 clean build and with the guarded environment above. The ordinary `playwright.config.ts` explicitly refuses `REPAIRDESK_E2E_ATOMIC_ONBOARDING_POSTGREST=1` before any webServer/plugin setup and points to the dedicated config. Do not use the ordinary config for this test.

The local Node 24 loopback release-server mutation E2E and the Vercel Node 24 preview build/smoke check are separate gates. A preview build may validate packaging/runtime only; it must never receive this mutation E2E or connect to production, and a staging artifact may not be promoted. The current writer environment used Node 20.20.2 only for local static/unit validation and is not release evidence. This task does not add or switch `SUPABASE_SECRET_KEY` in production; key rotation remains a separate approved operation.

## Stop conditions

Stop before migration or deployment if any of the following is true:

- the baseline commit or live migration marker does not match the recorded lineage;
- the function signature, security-definer property, empty search path, validation, idempotency, rate limit, DML, or return shape differs unexpectedly;
- any browser role retains `EXECUTE`, `service_role` loses it, or ACL inspection is inconclusive;
- backup/PITR readiness is unknown at a production gate;
- required environment variables are missing, ambiguous, or would require exposing a secret;
- tests, independent reviews, or schema reload/postchecks fail;
- a request would create a real production store, replay an old POST, or perform destructive cleanup without a new Owner decision.
- the rollback artifact hash differs, the staging drill cannot complete forward → rollback → fresh later-timestamp re-forward, any of the five invariant violation counts is non-zero, valid store/child/ledger counts change during rollback, the disposable branch exceeds four hours or `$0.054`, or cleanup ownership is unclear;
- a real E2E request is missing any Node 24 loopback/key-mode/branch-ref gate, has a non-0600/external or unsafe storageState, sees a non-loopback or production cookie/origin, captures media artifacts, mocks the critical create route, or does not observe a real POST 2xx with the exact UUID/name shape;
- the independent Node 24 local release-server gate or Vercel Node 24 preview build/smoke gate is unavailable, is pointed at production, or attempts to promote a staging artifact;
- any 15/30/60-minute observation threshold below is crossed.

## Rollback and recovery

Rollback is forward-only: stop traffic to the affected create-store path, retain the evidence and correlation ids, and apply a separately reviewed forward migration that restores the prior function body while preserving the explicit ACL boundary. Do not rewrite or delete an applied migration, run destructive SQL, or restore over production without an approved recovery plan. If data integrity is in doubt, pause writes and use the environment's approved backup/PITR recovery procedure after confirming the restore point and blast radius.

The exact rollback source is the inert, hashed `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` artifact (SHA-256 above). Its old `request.jwt.claim.role` gate intentionally restores the pre-forward availability behavior; it is a recovery option, not a production command. The artifact must be copied into a newly timestamped reviewed forward rollback migration and then verified by `pg_get_functiondef`, ACL, `prosecdef`, empty `search_path`, and no-schema-drift checks. After that rollback, the re-forward must be another new migration later than `20260823141758`; never edit, delete, or reuse an already-applied migration. Neither rollback path deletes successful stores, child rows, or operation-ledger rows.

There is no automatic replay of historical failed POSTs. A customer/operator may retry interactively only after the service is healthy; reuse the same request id unless the server returned an idempotency conflict, in which case obtain a new request id through the normal UI flow.

## Observation thresholds

Record observations at 15, 30, and 60 minutes after any separately approved production release. This task has no production observation and remains NO-GO.

| Checkpoint | Continue only if                                                                                                                                                  | Stop / rollback trigger                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 15 minutes | zero `STORE_CREATE_FORBIDDEN` or unexpected 5xx responses; service-role canary response is 2xx with the required `activeStore.id/name`; no browser-role ACL grant | any one legacy-gate error, unexpected 5xx, malformed response, ACL drift, or leaked/raw error                                         |
| 30 minutes | exactly 1 successful canary mutation, completion in `≤10s`, zero timeouts, zero `503`, zero other `5xx`, and zero duplicate/partial writes                        | any count other than 1, completion `>10s`, any timeout/`503`/`5xx`, duplicate/partial write, or unresolved correlation/telemetry leak |
| 60 minutes | all prior invariants remain true, error rate is zero for the canary path, and backup/PITR evidence is recorded                                                    | any new invariant failure, unresolved 5xx, browser-role execute grant, or missing recovery evidence                                   |

Any stop trigger pauses new writes, preserves redacted evidence, and uses the reviewed forward rollback path. Do not auto-replay failed requests.

## Production approval and canary

The current Owner instruction authorizes implementation, tests, and release preparation only. Production migration/deployment remains a D4 boundary. A real production canary, production store creation, secret rotation, or any customer-data operation requires a separate explicit Owner approval after all gates, exact lineage verification, backup/PITR confirmation, and rollback readiness are recorded. This runbook does not grant that approval.

Staging artifacts, branches, storage states, and E2E evidence are never promoted to production. The only permitted cleanup is deletion of the disposable staging branch/worktree by the Integration Lead after the drill; no production data or account is deleted.
