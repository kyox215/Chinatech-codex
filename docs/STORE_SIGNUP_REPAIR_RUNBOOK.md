# Store signup repair runbook

Status: production migration applied and verified on 2026-08-27. This runbook is the release, smoke, observation, and forward-only recovery SOP. The ordinary `main` push and automatic Vercel deployment are still pending and are not claimed complete. No validation may leave a real or test store or any derived rows behind.
Owner: `RepairDesk Integration Lead`. Temporary server-key compatibility exit deadline: `2026-10-31`.

## Baseline and lineage

- Clean implementation baseline: production commit `7b47c0afcb2bea5f1069553555c701bc75549d46`.
- Current live migration marker: `20260823141758` (the target migration was formally applied through the CLI on 2026-08-27).
- The historical migration `supabase/migrations/20260724114500_atomic_store_onboarding.sql` is immutable and must remain byte-for-byte unchanged.
- Forward migration: `supabase/migrations/20260823141758_repairdesk_store_create_service_role_compat.sql`.
- Committed migration lineage: `120` rows and `120` unique versions; target version `20260823141758` appears exactly once; ordered version digest is `198a7352a87f97b3af32c78f379089af`.
- Committed RPC shape: `prosrc` MD5 `37a66657deb13eec088ccfa785a84bab`, function-definition MD5 `5b94c5b6eb724393d715166567bb8ae9`, owner `postgres`, language `plpgsql`, `SECURITY DEFINER`, empty `search_path`, and ACL exactly `{postgres=X/postgres,service_role=X/postgres}`. The legacy claim gate and `STORE_CREATE_FORBIDDEN` are absent.
- Inert rollback artifact: `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql`.
- Rollback artifact SHA-256: `4ee9dae7a6d91cec62d20808c16aa2ca0b74c0f821fa0f71110875c38e4bcc75`.
- Production rollback-only rehearsal: preflight `73a9a301fdb059eca93dbb6d65281db1638167417f2fa393307dc4def983a9e5` plus postcheck `84cadf5818a06df7a3fca3d17b3195acc57bd97699340f429f5d0172c641e846`; both completed with zero synthetic residue.
- Committed-state rollback-only canary: `22e036499cdb5f908c8f763783e0ac078e6e2f8d9398cb8af45bb3bcff2d7b71` plus postcheck `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153`; completed with zero synthetic residue.
- Verified trigger baselines: 18 normal triggers digest `ae020a10a9e2aa1e01e3ca072cf3fa2d` and 6 managed event triggers digest `2c0a081b2cc0db6f27b87dab4016c671`.
- The current dry-run is up to date. Never retain a real or test store, repair or replay migration history, or use `--include-all` or `--force`.
- Verify the exact commit, migration filename, and migration body in a clean worktree before any linked-environment action. Do not infer lineage from a branch name or local dirty tree.

## Release lineage and remote verification

- The database migration was applied from the approved candidate worktree through the CLI on 2026-08-27; the live ledger and RPC facts above are the current remote evidence.
- Before the pending delivery, verify the exact candidate commit/tree, sanitized GitHub repository, configured root, and target ref. Push to `main` only as an ordinary non-force push; do not squash, amend, merge, cherry-pick, repair history, use `--include-all`, or use `--force`.
- After the push, verify the remote `main` SHA and tree, then verify that Vercel's automatic deployment uses that same commit. Main push and Vercel deployment are pending in this runbook; do not claim either is complete without remote evidence.

## What the forward migration changes

The migration replaces the existing `public.repairdesk_create_store_atomic_rpc` with the same signature and the same `SECURITY DEFINER`, empty `search_path`, validation, email check, advisory lock, idempotency, rate limit, DML, transaction, and return shape. It removes only the obsolete `request.jwt.claim.role` gate.

The final ACL is the authority boundary: `PUBLIC`, `anon`, and `authenticated` are explicitly revoked, and `service_role` is granted `EXECUTE`. No table, column, index, RLS policy, backfill, purge, or data-retention change is included. PostgREST schema reload notification is sent after the ACL statements.

Supabase's current API-key guidance describes `sb_secret_...` keys as backend-only elevated keys equivalent to the service-role capability, while legacy `service_role` keys remain supported. As a short-term compatibility policy, the application trims both variables, prefers a non-empty `SUPABASE_SERVICE_ROLE_KEY`, and falls back to a non-empty `SUPABASE_SECRET_KEY` only when the legacy variable is absent or blank; if both are absent or blank, configuration fails closed. This order reflects the observed production result that the secret-key path returned `401` while the legacy-key path returned `200`; no key value is included. Owner: `RepairDesk Integration Lead`; exit deadline: `2026-10-31`. This run does not read, record, or rotate either key value. After a new secret key succeeds for REST, Auth, Storage, and RPC checks plus the existing authenticated read-only onboarding verification, a separately approved credential rotation may revoke the legacy key and restore secret-first selection. See the [official Supabase API keys guide](https://supabase.com/docs/guides/getting-started/api-keys).

## Preconditions and read-only prechecks

Run these read-only checks against the approved release environment, using an operator account that can inspect metadata without exposing credentials:

1. Verify the historical migration is byte-for-byte unchanged and the candidate worktree contains the approved migration body. Do not infer lineage from a branch name or a dirty tree.
2. Confirm the live migration marker is `20260823141758`, the ledger is `120` rows/`120` unique versions, the target occurs once, and the ordered digest is `198a7352a87f97b3af32c78f379089af`.
3. Inspect the target function's signature, both committed hashes, owner/language, `prosecdef`, empty `search_path`, exact ACL, absence of the legacy gate, and required source invariants. Do not call the function with customer data or create a store during read-only checks.
4. Confirm `PUBLIC`, `anon`, and `authenticated` do not have `EXECUTE`; confirm `service_role` does. Confirm the 18-trigger and 6-event-trigger digests match the recorded values.
5. Backup evidence is accepted: `2026-08-27T06:49:20.966Z` is `COMPLETED` and `PITR=false`. Record the evidence identifier without exposing credentials or customer data.
6. Confirm the rollback rehearsal and committed-state canary hashes above, their postchecks, and zero synthetic residue. The current dry-run is up to date.

## Forward application order

1. Complete the DATA, SEC, QA, and Release reviews of the already-applied migration, repository/router response, client retry behavior, tests, and this runbook.
2. Verify the committed ledger/RPC/ACL/trigger baselines and the rollback-only evidence above in a clean release worktree.
3. Do not reapply `20260823141758`, edit or replay migration history, repair history, or use `--include-all`/`--force`.
4. Perform the independent read-only postcheck for the function definition, ACL, trigger/event digests, synthetic residue, and advisory-lock residue.
5. Push the approved application changes to `main` with an ordinary non-force push; Vercel's automatic deployment follows that push. Both remain pending and require remote verification.
6. Run the authenticated read-only smoke against the verified deployment. Do not issue a create-store POST, create a real/test store, or retain any canary data.
7. Observe error rates, ACL-denial signals, and sanitized availability telemetry (`event`, `status`, `errorCode`, `requestId`) without recording raw Supabase/SQL errors or secrets.

## Staging-only already-forward 120 → rollback 121 → re-forward 122 drill

This drill is an optional release rehearsal only. Do not execute the inert SQL file directly, do not run it against production, and do not promote a staging artifact. A separately reviewed forward migration may copy the exact commented body from `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` only after explicit staging authorization. No real or test store may remain after any rehearsal.

1. Create the Supabase disposable staging branch from the verified and approved production-based data-less database baseline/lineage; never use `--with-data`. Independently use a clean Git release worktree whose `HEAD` is the approved candidate SHA recorded in the release evidence; verify its parent and tree before any linked action, and never treat the Git baseline commit as the source of the database branch. Before any postchecks, require active migrations `120` files/`120` unique versions and the branch migration ledger exactly `120`/`120` as an already-forward state, with signup applied exactly once and the production version set differing only by the signup migration. Do not apply `20260823141758` again. Verify repo-only toolkit/lifecycle objects are absent, and verify SeaTable catalog, ACL, RLS, and owner parity against production before accepting the branch. Verify the non-production origin/project-ref allowlists and the read-only prechecks above.
2. At the initial already-forward `120` state, reload PostgREST if required by the approved branch procedure and run the read-only function/ACL/invariant checks plus the authenticated read-only smoke; do not apply the signup forward migration again, issue a create-store POST, or retain a synthetic store.
3. Stop the staging create path, create and apply a newly timestamped reviewed forward rollback migration producing ledger state `121` and containing the artifact's exact historic function gate and ACL, reload PostgREST, and confirm the old gate is restored without table/data/policy changes. State `121` is rehearsal-only and never promotable.
4. After rollback, create a fresh, later-timestamped reviewed re-forward migration producing ledger state `122` that copies the forward function body, ACL declarations, and schema reload exactly. It must be newer than the already-applied `20260823141758`; never reuse that migration version. Apply it, rerun the read-only checks and authenticated read-only smoke, and confirm the service-role/no-claim contract without creating or retaining a store. State `122` is rehearsal-only and never promotable. Any mismatch stops the drill.
5. For each stage, record the five **data invariant** violation counts below; every initial `120`, rollback `121`, and re-forward `122` count must be exactly `0`:

   | Data invariant                                             | Initial 120 | Rollback 121 | Re-forward 122 |
   | ---------------------------------------------------------- | ----------: | -----------: | -------------: |
   | Active store missing its active lifecycle                  |         `0` |          `0` |             `0` |
   | Active store missing its active owner membership           |         `0` |          `0` |             `0` |
   | Per-store settings row count is not exactly `1`            |         `0` |          `0` |             `0` |
   | Enabled default-create status row count is not exactly `1` |         `0` |          `0` |             `0` |
   | Operation ledger references a store that does not exist    |         `0` |          `0` |             `0` |

   Separately record the metadata/behavior checklist—not part of these five data counts—for the exact function signature, `SECURITY DEFINER`, empty `search_path`, email/input validation, advisory lock, rate limit, idempotent replay/conflict behavior, atomic DML/child-row rollback, and return shape. Any synthetic validation rows must be transaction-local and end at zero; the forward rollback migration must preserve unrelated stores, child rows, and operation-ledger rows.

6. Preserve redacted evidence and delete only the disposable branch/worktree after review. Cleanup owner is the Integration Lead; no store, customer, ledger, or production data may be deleted.

The rehearsal branch TTL is at most four hours. Its infrastructure budget is capped at `$0.01344/hour` and approximately `$0.054` total. The owner must destroy the branch before the TTL/cost ceiling; no automatic cleanup or production promotion is allowed.

## Authenticated read-only smoke and release delivery

After the approved ordinary non-force `main` push and Vercel's automatic deployment, run an authenticated read-only smoke against the verified deployment origin. Check the authenticated shell, the signup route, the typed availability/error presentation, and read-only API responses. Do not issue `POST /api/repairdesk/stores/create`, create a real or test store, retain a persistent canary, or record credentials, raw SQL errors, or customer data.

A local build and the Vercel deployment are separate gates: a build proves packaging only, while the deployed commit and health must be checked remotely. If the Vercel deployment is unhealthy, use the reviewed Vercel rollback plan to return to the last verified deployment, then rerun the authenticated read-only smoke. Main push and Vercel deployment are pending here; this runbook does not claim either is complete.

## Stop conditions

Stop before any new delivery, rollback, or smoke action if any of the following is true:

The `120 → 121 → 122` staging drill, its TTL/cost ceiling, and its cleanup conditions apply only if that optional drill is separately authorized and actually started. For this release, the approved gates are the production rollback-only rehearsal and committed-state canary recorded above; completing the staging drill is not required.

- the baseline commit or live migration marker does not match the recorded lineage;
- the function signature, security-definer property, empty search path, validation, idempotency, rate limit, DML, or return shape differs unexpectedly;
- any browser role retains `EXECUTE`, `service_role` loses it, or ACL inspection is inconclusive;
- neither the recorded `2026-08-27T06:49:20.966Z COMPLETED` backup with `PITR=false` nor a newer separately audited `COMPLETED` backup snapshot is available;
- required environment variables are missing, ambiguous, or would require exposing a secret;
- tests, independent reviews, or schema reload/postchecks fail;
- a request would create or retain a real/test store, replay an old POST, or perform destructive cleanup;
- the rollback artifact hash differs, or the approved production rollback-only rehearsal/committed-state canary evidence is missing or invalid;
- the separately authorized and actually started staging drill cannot complete forward → rollback → fresh later-timestamp re-forward, any of its five invariant violation counts is non-zero, valid store/child/ledger counts change during rollback, its disposable branch exceeds four hours or `$0.054`, or its cleanup ownership is unclear;
- the authenticated read-only smoke is unavailable, reaches an unverified origin, attempts a mutation, or exposes credentials/raw errors;
- the ordinary `main` push is not non-force, the Vercel automatic deployment does not use the verified commit, or the reviewed Vercel rollback path is unavailable;
- history repair, `--include-all`, `--force`, or promotion of a staging artifact is proposed;
- any 15/30/60-minute observation threshold below is crossed.

## Rollback and recovery

Database rollback is forward-only: stop traffic to the affected create-store path, retain the evidence and correlation ids, and apply a separately reviewed forward migration that restores the prior function body while preserving the explicit ACL boundary. Do not rewrite, delete, or replay an applied migration, use `--include-all` or `--force`, run destructive SQL, or restore over production without an approved recovery plan. If data integrity is in doubt, pause writes and use the environment's approved backup/PITR recovery procedure after confirming the restore point and blast radius.

The exact rollback source is the inert, hashed `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` artifact (SHA-256 above). Its old `request.jwt.claim.role` gate intentionally restores the pre-forward availability behavior; it is a recovery option, not a production command. The artifact must be copied into a newly timestamped reviewed forward rollback migration and then verified by `pg_get_functiondef`, ACL, `prosecdef`, empty `search_path`, and no-schema-drift checks. After that rollback, the re-forward must be another new migration later than `20260823141758`; never edit, delete, or reuse an already-applied migration. Neither rollback path deletes successful stores, child rows, or operation-ledger rows.

No D3 replay of historical failed POSTs is required or automatic. A customer/operator may retry interactively only after the authenticated read-only smoke is healthy; reuse the same request id unless the server returned an idempotency conflict, in which case obtain a new request id through the normal UI flow. This does not authorize a test-store mutation.

## Observation thresholds

Record observations at 15, 30, and 60 minutes after the pending `main`/Vercel release. The database apply and rollback-only rehearsals are complete; delivery and observation remain pending until remote evidence is recorded.

| Checkpoint | Continue only if                                                                                                                                                  | Stop / rollback trigger                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 15 minutes | authenticated read-only smoke passes; zero `STORE_CREATE_FORBIDDEN` or unexpected 5xx responses; no browser-role ACL grant or synthetic residue | any legacy-gate error, unexpected 5xx, unverified origin, ACL drift, mutation, or leaked/raw error |
| 30 minutes | verified `main`/Vercel commit is healthy; zero timeouts, zero `503`, zero other `5xx`, and zero duplicate/partial writes | any timeout/`503`/`5xx`, duplicate/partial write, deployment mismatch, or unresolved correlation/telemetry leak |
| 60 minutes | all prior invariants remain true, authenticated read-only smoke remains healthy, error rate is zero, and accepted backup evidence remains recorded | any new invariant failure, unresolved 5xx, browser-role execute grant, synthetic residue, or missing recovery evidence |

For a Vercel/app/runtime/environment/read-only-smoke failure, roll Vercel back to the last verified deployment and retain the database migration while the database remains healthy. For a database function/ACL/ledger/invariant failure, stop the create path and use the separately reviewed forward-only database rollback; roll Vercel back as well when necessary. Preserve redacted evidence for every stop trigger. Do not auto-replay failed requests.

## Production release, rollback, and canary policy

The migration, backup evidence, rollback-only rehearsals, committed-state canary, and read-only database postchecks are complete as recorded above. The ordinary non-force `main` push and Vercel automatic deployment are still pending; verify both remotely before claiming release completion. The production smoke is authenticated and read-only: no real or test store, persistent canary, customer-data mutation, or historical POST replay is permitted.

Database recovery remains forward-only. If the Vercel deployment is unhealthy, use the reviewed Vercel rollback plan to return to the last verified deployment, then rerun the authenticated read-only smoke. Staging artifacts, branches, storage states, and E2E evidence are never promoted to production. The only permitted cleanup is deletion of the disposable staging branch/worktree by the Integration Lead after the drill; no production data or account is deleted.
