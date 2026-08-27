# Handoff / Resume — TASK-20260823-002-store-signup-repair

## Current handoff

- **Status:** `in_progress`; R3/L2 contract with WP-05E correction-5/WP-05F correction-6 and WP-20260823-002-D3-CANDIDATE-FREEZE locally complete, Owner D3 staging-only approval recorded, lease v4 current, v12 DATA drift/Node24 evidence recorded, Owner choice between lineage-first and limited candidate-schema rehearsal pending; production remains NO-GO.
- **Last verified:** 2026-08-23T21:39:51Z.
- **Task identity:** project `repairdesk-chinatech`; task `TASK-20260823-002-store-signup-repair`; run `RUN-20260823-002-IMPLEMENT-001`; window `WINDOW-01A02EC5-STORE-SIGNUP-REPAIR`; initial packet v1 SHA-256 `1460e7cc01fc85f0ec7e56b0a2a30d2b90ef92e56be75a638498e6bbf276c2a6`; supplied doctor healthy with no integration lease.
- **Authority boundary:** packet binding proves identity only. The Integration Lead retains final integration, migration, deploy, secret, production, commit, and user-report authority. This worker wrote task memory only.
- **Workspace:** shared branch `main...origin/main [ahead 3, behind 90]` with unrelated dirty/untracked files. Do not use it for business implementation; preserve all existing edits and create/verify an isolated clean worktree first.
- **Production baseline to verify:** supplied deployment commit `7b47c0afcb2bea5f1069553555c701bc75549d46` and latest live migration marker `20260810173610`. These are unverified baseline metadata, not local parity or release proof. A real production canary requires a separate explicit Owner approval after all gates.

## Verified facts to carry forward

1. Four reported create-store attempts failed at the RPC function-head legacy `request.jwt.claim.role` gate with `STORE_CREATE_FORBIDDEN`; signup/verification/onboarding reads succeeded and no known store/operation residue was created.
2. The RPC is `SECURITY DEFINER`, `set search_path = ''`, exact-signature, and service-role-only by ACL. Browser roles must remain denied.
3. Current repository mapping hides the stable backend code as generic HTTP 400/UI retry text. Existing pgTAP manually sets the legacy claim; browser E2E mocks the route.
4. A current Supabase secret key is an elevated backend-only key mapped to `service_role`; legacy `service_role` remains supported. The production key value/category was not accessed and must stay out of memory/logs.
5. Exact deployed source parity and backup/PITR readiness are unknown until WP-00; release must stop if either cannot be proven.

## Implementation handoff to the single business writer

Use one Luna writer in an isolated clean worktree. Owned future paths are constrained to:

- one new forward migration under `supabase/migrations/` (timestamp chosen after lineage check), never the historical `20260724114500_atomic_store_onboarding.sql`;
- `src/server/supabase.ts` for server-only new-secret/legacy fallback;
- `src/features/stores/server/store.repository.ts` for safe typed infrastructure error mapping only;
- `src/server/api/repairdesk-router.ts` and, only if necessary for request-ID propagation, `src/app/api/repairdesk/[...path]/route.ts`;
- `src/lib/repairdesk/api.ts` and `src/features/auth/screens/onboarding-screen.tsx` for the typed response/actionable UI contract;
- scoped store-create tests (`supabase/tests/atomic_store_onboarding.sql`, existing store repository/router tests, a server config test if needed, the existing atomic E2E, and one gated real-PostgREST E2E);
- new `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` only for this repair.

No other files may be edited without a revised package. Preserve BFF auth, verified-email recheck, tenant boundaries, validation, rate limit, idempotency, transaction, lifecycle/default-status, audit, settings, template, workflow, membership and ledger behavior.

## Dependency order and exit signals

1. **WP-00 preflight:** clean lineage, non-secret function/ACL/proconfig/invariant snapshots, backup/PITR. If blocked, stop before code/migration.
2. **WP-01 migration:** static + linked dry-run parity; reviewers confirm only redundant gate removal and exact ACL/search-path/security-definer invariants.
3. **WP-02 API:** new-secret/legacy fallback and typed 503/correlation ID; no raw DB error, secret or PII in logs/response.
4. **WP-03 UI:** actionable message and safe request-ID retry; no duplicate or optimistic store state.
5. **WP-04 tests:** real service-role/no-claim and both key modes in isolated/staging; browser-role denial, negative roles, invalid/unverified/rate/idempotency/rollback cases; no residue.
6. **WP-05 docs/release:** runbook, approvals, canary, rollback and observation plan complete.
7. **WP-06 production:** only after explicit Owner release approval; never replay the historical POSTs; observe 15/30/60 minutes.

## Immediate stop conditions

- Any browser-role grant, changed RPC signature, non-empty search path, lost `SECURITY DEFINER`, removed layered auth/email/tenant checks, duplicate/orphan/partial rows, unverified or negative-role success, or leaked secret/PII.
- Any missing lineage/recovery evidence, migration parity mismatch, `STORE_CREATE_FORBIDDEN` after the forward migration, unexpected error/latency increase, or unavailable rollback.
- Any request to inspect production secret values, run destructive SQL, create/delete a real production store, auto-replay failed POSTs, deploy/migrate without gates, or broaden file ownership.

## Validation and screenshot note

- This handoff is backend/data/API/test/docs governance work; no new task page or browser-visible result was produced by this intake worker, so there is no new screenshot path. The prior audit's Owner-provided symptom screenshot remains input evidence only and is not a successful-flow proof.
- The Integration Lead must run the permitted scoped trailing-whitespace/diff check and read-only doctor after these five memory files are reviewed. Later code/UI work must provide its own test/build/browser and screenshot evidence where applicable.

## Resume first actions

1. Read this handoff, `TASK.md`, `EVIDENCE.md`, and latest checkpoint; verify no conflicting edits in the five owned files.
2. Confirm the packet is still current; if contract or identity changes, issue/verify a new packet through the Integration Lead rather than using this text as authority.
3. Perform WP-00 in a clean isolated worktree; do not use the shared dirty tree for implementation.
4. Spawn/assign exactly one scoped business writer and independent DATA/SEC/QA/Release reviews with disjoint ownership; record agent IDs and outputs before calling them “used”.
5. Keep task status `in_progress` until evidence supports `review`; do not close from this memory checkpoint.

## Reviewer-triggered correction handoff (pending)

- **Trigger:** DATA/SEC/RELEASE finding E-013 identified minimum staging-safety, rollback-evidence, invalid-UUID disclosure and runbook-control gaps after the initial implementation package. This is a contract correction, not proof that the gaps are fixed.
- **Status:** `in_progress`; production migration/deploy/canary remains NO-GO.
- **Single writer:** the same Luna writer may use the existing isolated worktree, with no new writer, and only these exact paths:
  - `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` — inert/documentation-only, no automatic apply; exact old function gate/ACL/schema reload for staging forward→rollback→forward rehearsal; hash required.
  - `tests/e2e/atomic-store-onboarding-postgrest.spec.ts` — production host/project-ref hard fail, explicit non-prod allowlist, external state/domain mode `0600`, no trace/screenshot/video, wait for real POST 2xx.
  - `src/server/api/repairdesk-router.test.ts` — invalid UUID absent from response/log/correlation output.
  - `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` — branch TTL, cost ceiling, destroy owner, rollback hash/rehearsal, backup/PITR residual and 15/30/60 observation thresholds.
- **Not authorized:** `.env.example` is outside this correction allowlist and must not be modified; runbook text may describe env handling only. No SQL auto-apply, production domain/project ref, secret/PII, real production POST/store, deploy/migrate, or unrelated path change.
- **Review exit:** collect P-010–P-013 artifacts and DATA/SEC/QA/RELEASE dispositions. Until they are reviewed, do not describe the correction as fixed and do not advance to WP-06.

## WP-05D v3 reviewer correction handoff (pending)

- **Trigger:** 15:16:36Z v3 review E-014. WP-05C is not locally releasable because BFF/ref binding, final origin/state checks, rollback versioning and the observation baseline were insufficient.
- **Keep state:** task `in_progress`, R3/L2, production NO-GO. Same Luna writer and same isolated worktree; no new writer.
- **Only write paths:** `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `src/server/api/repairdesk-router.test.ts`, `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` is read-only; only a re-verified hash reference may change in runbook/evidence. `.env.example` is not authorized.
- **E2E gate:** Playwright must use `REUSE_EXISTING_SERVER=0` and start a fixed Node 24 loopback release server with exact command/base origin recorded. The process must inherit one explicit allowlisted non-production branch ref for BFF/client and require `SUPABASE_URL===NEXT_PUBLIC_SUPABASE_URL`; reject production host/ref; validate fixed repo-root regular non-symlink owner-matched 0600 storageState and pre-resolved cookie/origins; final goto/POST origins equal; wait for real POST 2xx and exact UUID/name. Vercel Node 24 preview build/smoke is a separate, production-inaccessible gate.
- **Router gate:** test real `handleRepairDeskPost('stores/create', invalid body, actor)` for 400 and absence of invalid ID from body/headers/log/correlation; retain fixed-code helper test.
- **Rollback/observation gate:** use a fresh re-forward migration after rollback and later than applied `20260823141758`; five invariants must be 0 after forward/rollback/re-forward, with valid store/children/ledger preserved; 30-minute absolute threshold is exactly 1 success, ≤10s, 0 timeout/503/5xx, with no invalid p95 baseline.
- **No-go:** no backend endpoint/production-source expansion, migration/DB/secret/deploy action, production host/ref, real production POST/store, trace/screenshot/video or other unrelated files. Correction evidence P-014–P-017 and v3 DATA/SEC/QA/Release verdicts are pending; do not advance WP-06 or claim fixed.

## WP-05E SEC v4 prelaunch-order correction handoff (pending)

- **Trigger:** SEC v4 E-015 (15:49:09Z) found a High blocker: default/global Playwright webServer/plugin setup can run before sensitive spec top-level guards. No credential-bearing run may use the current default config.
- **Keep state:** `in_progress`, R3/L2, production NO-GO; same Luna writer and same isolated worktree.
- **Only write paths:** `playwright.config.ts` (early sensitive-flag refusal/pointer), new `playwright.store-signup-postgrest.config.ts`, new `tests/e2e/support/atomic-store-onboarding-postgrest-env.ts`, `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. Rollback SQL and all other files are read-only/forbidden; `.env.example` is not authorized.
- **Shared guard:** env module must run before dedicated `defineConfig` and be reused by spec. It must fail closed for Node24, `requested=1`, exact loopback/base/command/`REUSE_EXISTING_SERVER=0`, URL/ref equality/binding, key mode and all existing non-prod/storageState/domain controls.
- **Dedicated config:** hardcode testMatch, workers=1, list/no HTML reporter, storageState, trace/screenshot/video off, and webServer command/url/reuse=false. Default config must reject sensitive flag at config load before webServer/plugin setup and point to `--config=playwright.store-signup-postgrest.config.ts`.
- **Proof matrix:** malicious marker command under default config must not start or leave a marker; dedicated Node20 must fail before server start; synthetic Node24 secret/legacy mode lists must reach test discovery; all negative guards fail closed. Vercel Node24 preview build/smoke remains a separate production-inaccessible gate; runbook documents only the dedicated config command.
- **Exit/no-go:** collect P-018–P-021 and SEC/QA/Release verdicts. Until then WP-05E is not fixed; no backend endpoint/production-source expansion, secret/DB/migration/deploy, production host/ref, real POST/store or media artifact is allowed.

## Context-packet size correction handoff (2026-08-23T15:55:47Z)

- The previous live `TASK.md` is preserved mechanically at `TASK_ARCHIVE_20260823_PRE_WP05E.md`; the live packet was reduced to the current identity/status, objective and security/production boundary, complete WP-05E contract, acceptance/rollback/release/definition indexes, and dependency/next-step index.
- This is a size correction only: semantics, approvals, file ownership, pending gates, and production NO-GO are unchanged. The archive is historical context, not authorization; no repair, test pass, migration, deployment, or production claim is implied.
- Resume by reading `TASK.md`, this handoff, `CHECKPOINTS.md`, and the archive only when historical detail is needed. Treat WP-05E/WP-05F as local-candidate complete per v5 packets, but keep WP-06 blocked and production NO-GO until the external D3/staging and D4 gates are evidenced.

## WP-05E/WP-05F v5 post-review handoff (local candidate complete; production NO-GO)

- **Reviewer state:** WP-05E correction-5 and WP-05F correction-6 completed in the isolated v5 candidate. SEC packet `64ef52...4048` is Local static PASS with the old prelaunch High CLOSED; QA packet `f2bf54...725ca` is PASS; Release packet `92bdae...1d24` is CONDITIONAL PASS to local candidate freeze; DATA v4 PASS is reusable because migration/data did not change.
- **Provenance:** writer v5 SHA `035ed9...bada`; root v5 SHA `65d611...d5d5`; candidate 9 modified + 7 untracked / 16 authorized paths; HEAD remains baseline; no stage/commit/push/deploy/migrate/secret/DB action occurred.
- **QA cleanup:** default malicious-marker and dedicated Node20 runs failed prelaunch with no marker; synthetic Node24 secret and legacy modes each reached discovery count 1; all negative guards failed closed. The short-lived pure-synthetic repo-local state was precisely deleted after the SEC stop; final state has no residue.
- **Hashes:** runbook `d1a5de56c22c9f98909f9c6ddff57e3d9fa80495e9b16da8d0da7e6e307f708e`; rollback `f4c12d553e719ac05c49b022b6879b0c91fbf45bdc9dd58648a7f505fd9527e0`; forward `1a55e5e8af78ccb20f23d1e046cdc2c76b160b9e571e4c27965043c7b368c8e1`; global config `c5dbee5b...9c012`; dedicated `07914a3b...27ba5`; guard `8176ae1a...e20`; spec `e0681a71...88fd`.
- **Open gates:** candidate commit/Git approval; Owner D3 paid Supabase branch ≤4h/$0.054; clean Node24 build; pgTAP 19/19; secret+legacy real E2E; forward→rollback→fresh re-forward; Vercel preview; exact backup/PITR. Production remains a separate D4 gate.
- **Resume:** request/obtain D3. If approved, freeze the candidate and run only bounded non-production staging gates under the time/cost cap. Without D3, remain in review and do not create a branch, run real mutation, migrate, deploy, or change `.env.example`.
- **Authority:** this worker projected reviewer evidence into task memory only; no checkpoint CLI, Registry/`ACTIVE_CONTEXT.md`, secret, DB, migration, deployment, or production action was performed.

## WP-20260823-002-NODE22-VALIDATE handoff (completed local validation; D3 blocked)

- **Packet/toolchain:** writer v6 packet `fa9fcb2e4e573c2dcae7ba82988c22a64043681f5c4542e16d200948ce4c12ad`; real Node `v22.12.0` / npm `10.9.0`.
- **Results:** typecheck PASS (~2s), changed-file ESLint PASS (~2s), full Vitest PASS (454 files/3,002 tests, ~23s), sandbox-only Google Fonts first-build failure followed by network-permitted `npm run build` PASS (~17s) with Next 16.2.11/Turbopack, TypeScript and 30/30 pages; Node22 dedicated-config run failed at the Node24 gate prelaunch with marker absent; fixtures removed.
- **Candidate boundary:** 16 authorized paths; HEAD/merge-base baseline; diff check, historical migration, whitespace and stable hashes unchanged; only ignored `.next`/`playwright-report`; no source/secret/DB/staging/commit/push/deploy change. Cached Node 24.15.0 is not Node24 evidence before D3.
- **Blocker/next:** Owner D3 remains unapproved for candidate Git action, ≤4h/$0.054 paid branch, non-production keys, real Node24, pgTAP 19/19, both credential modes, rollback/re-forward and Vercel; exact backup/PITR and D4 remain missing. Request/obtain D3; otherwise preserve candidate and do not run real mutation or production action.
- **Blocked-audit:** this same authorization blocker recurred in the original Owner turn and two goal continuations; the main thread decides whether to mark the goal blocked. Task remains `in_progress`, production NO-GO.

## Owner D3 approval / resume handoff (staging-only; production NO-GO)

- **Approval:** Owner approved local candidate commit, necessary non-production push, a temporary Supabase branch capped at 4 hours/$0.054, real Node24 build, pgTAP, both key modes, rollback/re-forward and Vercel Preview; production release is explicitly excluded.
- **Risk/authority:** remain R3/L2. D3 does not authorize production migration/deploy/promotion/canary/store creation, production key change/inspection, historical POST replay or destructive production SQL; D4 remains separate.
- **D3 unlocks:** candidate Git action, branch credentials, staging migration/pgTAP/secret+legacy E2E, new-timestamp rollback/fresh re-forward, Vercel Preview and cleanup. Branches are independent, have no production data and independent credentials; secret-key backend-only/service_role and legacy coexistence are documented only at https://supabase.com/docs/guides/getting-started/api-keys, with no values recorded.
- **Resume sequence:** v8 packet → integration lease → candidate freeze → bounded D3 staging rehearsal → cleanup/evidence. Approval is not a lease or execution result; keep production NO-GO.

## CHECKPOINTS context-source size correction (2026-08-23T21:45:45Z)

- The required source cap is `SOURCE_MAX_BYTES = 28_000` in `tools/orchestration/context.py`; pre-compaction `CHECKPOINTS.md` was 28,727 bytes and is preserved byte-for-byte at `CHECKPOINTS_ARCHIVE_20260823_PRE_COMPACTION.md` (SHA-256 `ef40bc0de304b356539ab4c5250a37b3c8e93ec8e0389290ff2be4787e338f66`).
- Live `CHECKPOINTS.md` is now a compact projection retaining identity, status, D3/v8 gates, blockers, next action and E/P pointers. Semantics and approvals are unchanged; read the archive only for historical detail.
- This was memory-only maintenance: no Registry/`ACTIVE_CONTEXT.md`, business source/config, secret, DB, migration, deploy, checkpoint CLI or production action was used.

## D3 candidate-freeze correction handoff (2026-08-23T21:52:28Z)

- **Precommit finding:** `git diff --cached --check` found one `new blank line at EOF` at `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql:236`; identity/baseline/exact-16-path/known-hash/historical-migration/whitespace-untracked/secret-scan checks otherwise passed.
- **Authorized correction:** same Luna writer, same isolated worktree and same WP; write only the rollback artifact to remove that one final blank line (no SQL semantic/content change), and update only the rollback SHA reference in `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. All other paths remain forbidden.
- **Before candidate commit:** regenerate the rollback hash, prove exact uncommented historical function+ACL equality and inert all-comment artifact, rerun cached diff check, and obtain DATA/SEC re-review. This is not a commit, migration, push, deploy or production claim.
- **Boundary/next:** production remains NO-GO; no DB, secret inspection/change, push, deploy, historical POST replay or production store. Complete this correction only after v8 packet/lease/freeze, then preserve evidence and keep task-memory sources under the packet cap.

## D3 candidate freeze completed handoff (CAS v3, 2026-08-23T22:04:59Z)

- **Packets/review:** root v9 `aab140...d254`; writer v9 `7cffdb...f9f8`; DATA v9 `df43c9...8d66` PASS; SEC v9 `6edd51...83af` PASS.
- **Candidate:** `WP-20260823-002-D3-CANDIDATE-FREEZE` completed CAS v3 on local branch `codex/store-signup-repair-20260823`, commit `871d2ca9ef8de6af056001454d66b082a1ac7e0d`, tree `df6862f4f820b35a18434d7585e84f39cdd78778`, single parent/base `7b47c0afcb2bea5f1069553555c701bc75549d46`; exact 16 paths, worktree/index clean, commit diff check PASS.
- **Artifacts:** rollback SHA `4ee9dae7a6d91cec62d20808c16aa2ca0b74c0f821fa0f71110875c38e4bcc75`; runbook SHA `8f5d6cf3988163ab70c56a5ce82feec96d2c165a95bc504c85ba262a712937c3`; forward/pgTAP/historical migration unchanged.
- **Boundary:** no push, Supabase branch creation, DB, secret, deploy or production action. Quoted branch cost is `$0.01344/hour`, max four hours `$0.05376`; branch is not yet created. Integration lease v2 is current; production remains NO-GO.
- **Next:** issue/verify instruction v10 packets, confirm cost, create the bounded non-production branch with TTL, then execute staging WP and collect P-027 evidence. D4 remains separate.

## D3 branch-provision fail-closed handoff (2026-08-23T22:09:22.949752Z)

- **Writer/target:** writer v10 packet `733f9b38...58b4` verified; candidate `871d2ca9...7e0d` clean; exact branch cost `$0.01344/hour` confirmed; integration lease v2 remains current.
- **Provision record:** pre-list empty; branch `store-signup-repair-d3-871d2ca9`, id `8b387cc7-c951-4825-8a12-4c0602a9fa4b`, project ref `tmdebsvqvcrkburxyshp`, created `2026-08-23T22:09:22.949752Z`, hard deadline `2026-08-24T02:09:22.949752Z`.
- **Lineage stop:** read-only branch lineage had only three migrations through `20260518150000`, not expected production marker `20260810173610`; candidate migration absent. Delete was immediate and by exact branch id; post-list showed production main only and branch absent.
- **Boundary:** no DDL/DML, test user/key persistence, push, Vercel, deploy or production action; no retained branch or further cost. WP branch provision is a fail-closed attempt, not staging PASS.
- **Next:** instruction v11 read-only branch-action/lineage investigation; do not pay/retry until cause and safe method are confirmed. Production remains NO-GO.

## v11 lineage investigation handoff (2026-08-24 projection)

- **Packet/WP:** writer v11 packet `57577b4d...9044`; lineage investigation CAS v3; candidate `871d2ca9...7e0d` clean; integration lease v2 remains current.
- **Confirmed lineage counts:** production `list_migrations` and direct ledger each count 119, first `20260213234620`, latest `20260810173610`; repo candidate has 121 timestamped files. Repo-only: `20260806222149`, `20260807120000`, `20260807120100`, `20260823141758`; production-only: `20260804225445`, `20260804230127`.
- **Branch/CLI observations:** deleted branch had only three migrations through `20260518150000`; `get_project` not found; branch-action logs empty; exact cause unproven. CLI 2.101.0 help-only inspection showed official branch create and optional `--with-data`; no operation invoked.
- **Boundary:** same-method paid retry is NO-GO. No push/branch, candidate/source mutation, secret, DB, DDL/DML, test user/key persistence, Vercel or deploy action occurred. This is investigation evidence, not staging PASS.
- **Next:** DATA/INT object-level reconcile the five pre-candidate drift versions and determine whether an official GitHub/CLI data-less branch path is safe without candidate/source mutation. Do not create another branch or pay until reviewed; production remains NO-GO.
- **Evidence archive:** full pre-v11 `EVIDENCE.md` is byte-faithfully retained at `EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md`; live EVIDENCE is a compact ID-preserving projection.

## v12 / lease v4 handoff (2026-08-24 projection)

- **DATA drift:** packet `b35bbc2c5c85ede7306c7043504a9cf821f8133547f2303570dc1d75c45fb3d1`; production-only ledger `20260804225445`/`20260804230127` map to local-main aliases `20260804140252...`/`20260804225900...`; repo-only `20260806222149`/`20260807120000`/`20260807120100` absent in production. Local main `353fb0eb` has SeaTable aliases only; origin/main `e427c375`, deployed `7b47c0af`, candidate `871d2ca9` have toolkit/lifecycle; no ref has both. Full parity staging NO-GO; limited candidate-schema static conditional only, not parity/release evidence.
- **Node24:** `WP-20260824-002-D3-NODE24-BUILD` CAS v3, writer v12 `d44bf90bab938b21482df0bb5349a76319f46d60d8502368ad37dff4c10b05a6`; Node v24.19.0 at `/private/tmp/node-v24.19.0-darwin-arm64/bin/node`, npm10.9.0, Next16.2.11; authorized font retry PASS 18s with TS/30 pages. No secret/DB/server/browser/push/deploy/migrate/file change; ignored outputs only.
- **Decision/next:** lease v4 current; previous branch deleted/no retained cost and second paid branch/push/Vercel did not occur. Owner chooses recommended lineage-reconcile/re-freeze/full D3 or limited candidate-schema static rehearsal; DATA/INT must bound the selected path. Production remains NO-GO.
