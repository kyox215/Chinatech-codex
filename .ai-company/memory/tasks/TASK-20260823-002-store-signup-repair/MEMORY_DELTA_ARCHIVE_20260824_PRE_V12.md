# Memory Delta — TASK-20260823-002-store-signup-repair

This delta is a candidate for later consolidation only. It is not a project-wide memory write and contains no secret, token, session, full customer PII, or production payload.

## Candidate project facts

- **Fact:** `TASK-20260823-002-store-signup-repair` is `in_progress`, classified T3/R3/L2, and moved from the prior read-only audit into bounded implementation/test/release-preparation mode after the Owner's explicit instruction. **Source:** current `TASK.md`, checkpoint 2026-08-23T14:06:12Z. **Status:** current task fact. **Owner:** Integration Lead / Owner. **Scope:** this repair only. **Review trigger:** task status transition or scope change.
- **Fact:** The confirmed direct blocker is the redundant `request.jwt.claim.role` check at the head of the service-role-only atomic store-create RPC; function signature, `SECURITY DEFINER`, empty search path, validation, idempotency, rate limit, transaction and DML are protected invariants. **Source:** inherited audit E-004/E-007 and `supabase/migrations/20260724114500_atomic_store_onboarding.sql:54-56,240-245`. **Status:** confirmed baseline. **Owner:** DATA/SEC. **Scope:** store-create RPC. **Review trigger:** migration review.
- **Fact:** Current production baseline identifiers supplied to the task are deployment commit `7b47c0afcb2bea5f1069553555c701bc75549d46` and latest live migration marker `20260810173610`; exact parity is unverified and the shared worktree is dirty/diverged. **Source:** Integration Lead task package plus `git status --short --branch`. **Status:** metadata only, not release evidence. **Owner:** INT/DATA/RELEASE. **Scope:** WP-00 preflight. **Review trigger:** before any migration, deploy, or canary.
- **Fact:** DATA/SEC/RELEASE findings triggered a minimal correction batch while task remains `in_progress` and production remains NO-GO. **Source:** E-013 and correction checkpoint 2026-08-23T14:52:30Z. **Status:** contract pending; not implemented/fixed. **Owner:** Integration Lead + same Luna writer. **Scope:** four exact correction paths only. **Review trigger:** before WP-06 or any release claim.
- **Fact:** v3 review E-014 triggered WP-05D because WP-05C did not bind the runner Supabase ref to the BFF, did not prove final page/POST origin and storage-state safety, reused applied rollback migration `20260823141758`, and used an invalid observation baseline. **Source:** 2026-08-23T15:16:36Z checkpoint and E-014. **Status:** confirmed finding; correction pending. **Owner:** Integration Lead + same Luna writer. **Scope:** WP-05D. **Review trigger:** focused v3 re-review.
- **Fact:** SEC v4 E-015 found a High prelaunch-order blocker: Playwright webServer/plugin setup can run before sensitive spec top-level guards. **Source:** 2026-08-23T15:49:09Z checkpoint and E-015. **Status:** confirmed security finding; WP-05E pending. **Owner:** SEC + Integration Lead. **Scope:** Playwright config/guard and sensitive E2E only. **Review trigger:** config-load negative proof.

## Candidate department updates

- **INT/DOC intake:** normalized the R3 implementation contract, file ownership, evidence matrix, rollback/stop conditions, approval boundary, and handoff. **Source:** this task's five memory files. **Status:** complete for intake; no business write. **Owner:** Integration Lead. **Scope:** task memory only. **Review trigger:** packet reissue or contract change.
- **Future API/DATA writer:** one Luna business writer must implement in an isolated clean worktree; no implementation writer is authorized in the current dirty shared worktree. **Source:** `TASK.md` change budget and checkpoint. **Status:** pending assignment. **Owner:** Integration Lead. **Scope:** listed migration/API/router/client/UI/test/doc paths only. **Review trigger:** WP-00 completion.
- **Future DATA/SEC/QA/Release reviewers:** independent read-only gates are required before any production action; a real production canary is a separate Owner-approved D4 action. **Source:** `TASK.md` release approval record. **Status:** pending outputs. **Owner:** respective departments. **Scope:** migration/security/quality/release evidence. **Review trigger:** WP-05/WP-06.
- **Reviewer correction finding:** DATA/SEC/RELEASE require production-host/project-ref hard stops, explicit non-prod allowlist, external state/domain mode `0600`, no trace/screenshot/video, real POST 2xx wait, invalid-UUID non-disclosure, branch TTL/cost/destroy-owner controls, rollback hash/rehearsal, backup/PITR residual and 15/30/60 observation thresholds. **Source:** E-013. **Status:** confirmed finding; correction pending. **Owner:** DATA/SEC/QA/RELEASE. **Scope:** WP-05C only. **Review trigger:** correction artifacts arrive.
- **Reviewer v3 finding:** E2E must use `REUSE_EXISTING_SERVER=0` with a fixed Node 24 loopback release server, exact base origin/command, same inherited allowlisted non-prod branch ref, URL equality, fixed-root owner-matched 0600 storage state, pre-resolved cookies/origins, final origin equality and real 2xx/UUID/name; Vercel preview smoke is separate and production-inaccessible. **Source:** E-014/P-014. **Status:** pending correction. **Owner:** QA/SEC/DATA/RELEASE. **Scope:** `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`. **Review trigger:** staging E2E evidence.
- **Reviewer v4 finding:** A shared guard must execute at dedicated config load before `defineConfig`/webServer/plugin setup, be reused by spec, and fail closed for Node24/requested=1/exact loopback/base/command/reuse0/URL-ref/key/storage/domain controls. Default config must refuse the sensitive flag before command start; dedicated Node20 must fail prelaunch; synthetic Node24 secret/legacy modes must reach discovery. **Source:** E-015/P-018–P-020. **Status:** pending correction. **Owner:** SEC/QA/RELEASE. **Scope:** five WP-05E paths. **Review trigger:** negative/positive guard matrix.

## Candidate decisions / ADRs

- **Decision:** Use one additive forward migration to remove only the legacy claim gate; never edit historical migration `20260724114500`; re-assert `PUBLIC`/`anon`/`authenticated` revokes and `service_role` grant. **Source:** prior audit E-007/E-010; current contract. **Status:** accepted implementation boundary, pending code/review. **Owner:** Owner + DATA/SEC/API. **Scope:** store-create RPC. **Review trigger:** migration diff or parity mismatch.
- **Decision:** Support a server-only new secret-key environment variable with legacy `SUPABASE_SERVICE_ROLE_KEY` fallback, guided by current Supabase key semantics, without storing key values. **Source:** official Supabase docs link in E-010; current code `src/server/supabase.ts`. **Status:** accepted design target, pending implementation/test. **Owner:** API/SEC. **Scope:** admin client configuration. **Review trigger:** secret/config review.
- **Decision:** Preserve the BFF actor and verified-email gates and map only infrastructure/config failure to safe typed HTTP 503 plus correlation ID; do not expose raw DB errors or weaken authorization. **Source:** prior audit E-005/E-007 and current contract. **Status:** accepted design target, pending implementation/test. **Owner:** API/SEC/QA. **Scope:** store-create route/client/UI. **Review trigger:** response/log contract review.
- **Decision:** Production migration/deploy and real production canary require clean-lineage/recovery evidence, DATA/SEC/QA/Release reviews, and explicit Owner approval; never automatically replay historical failed POSTs. **Source:** current approval boundary and prior audit handoff. **Status:** binding safety decision. **Owner:** Owner/Integration Lead. **Scope:** WP-06. **Review trigger:** release request.
- **Decision:** Allow one reviewer-triggered correction batch by the same Luna writer in the isolated worktree, limited to `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql`, `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, `src/server/api/repairdesk-router.test.ts`, and `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. **Source:** E-013, TASK.md correction contract. **Status:** accepted scope, pending implementation/review; `.env.example` is explicitly NOT authorized. **Owner:** Integration Lead. **Scope:** WP-05C; staging only. **Review trigger:** any extra path or production request.
- **Decision:** WP-05D narrows writes to the three existing E2E/router/runbook paths; rollback SQL remains read-only unless only a verified hash reference changes in text. **Source:** E-014 and WP-05D checkpoint. **Status:** accepted correction scope, pending implementation/review. **Owner:** Integration Lead. **Scope:** same isolated worktree; no `.env.example`, backend endpoint, production source, migration/DB/secret/deploy. **Review trigger:** any path expansion or hash mismatch.
- **Decision:** Rollback rehearsal must use a fresh re-forward migration later than applied `20260823141758`; five invariants must remain zero across forward/rollback/re-forward and valid rows must survive. Absolute 30-minute threshold is exactly 1 success, ≤10s, 0 timeout/503/5xx. **Source:** E-014/P-016/P-017. **Status:** binding gate, not completed evidence. **Owner:** DATA/SEC/QA/RELEASE. **Scope:** staging only. **Review trigger:** rehearsal report.
- **Decision:** WP-05E permits one same-writer security correction across exactly `playwright.config.ts`, new dedicated config, shared env guard, sensitive spec and runbook; rollback SQL remains read-only and all other paths, `.env.example`, backend/production source, migration/DB/secret/deploy remain forbidden. **Source:** E-015 and WP-05E checkpoint. **Status:** accepted scope, pending implementation/review. **Owner:** Integration Lead + SEC. **Scope:** prelaunch E2E safety only. **Review trigger:** path expansion or guard evidence.
- **Decision:** Rollback SQL must remain inert/non-auto-applied and restore the exact old function gate/ACL/schema reload only for staging forward→rollback→forward rehearsal; hash and rehearsal evidence are mandatory. **Source:** correction checkpoint and P-010. **Status:** design gate, not completed evidence. **Owner:** DATA/SEC/RELEASE. **Scope:** staging rollback artifact. **Review trigger:** artifact generation or hash mismatch.

## Candidate lessons and capability evidence

- **Lesson:** A page-level success or mocked route test cannot prove a real service-role/no-claim mutation; protected staging/PostgREST evidence must be part of the release gate. **Source:** inherited audit E-006 and planned P-004/P-005. **Status:** reusable QA/release lesson. **Owner:** QA/Release. **Scope:** authenticated database mutations. **Review trigger:** future mutation release.
- **Lesson:** Stable backend codes must survive repository/BFF mapping into safe typed status and correlation ID; generic 400 text prevents diagnosis and recovery. **Source:** inherited audit E-005 and planned P-007. **Status:** reusable API observability lesson. **Owner:** API. **Scope:** store-create and similar infrastructure failures. **Review trigger:** future error-contract work.
- **Capability evidence:** This intake worker completed policy/audit recovery and scoped memory-only writes while preserving a heavily dirty worktree; no business-code, database, secret, deployment, or production claim was made. **Source:** checkpoint and validation boundary. **Status:** task-local evidence only; not a capability-level promotion. **Owner:** Integration Lead. **Scope:** memory intake. **Review trigger:** task-close capability review.
- **Lesson:** Real-PostgREST E2E must be hostile to accidental production execution: explicit non-prod allowlist, production host/ref hard failure, `0600` external state/domain validation, no media capture, and a real POST 2xx wait. **Source:** E-013. **Status:** reusable QA/Release gate pending implementation. **Owner:** QA/SEC/RELEASE. **Scope:** staging mutation tests. **Review trigger:** before any staging run.
- **Lesson:** A preview build/smoke and a real mutation E2E are separate trust domains; the preview must be unable to connect production, while the loopback release server must attest the exact BFF/branch/origin binding. **Source:** E-014/P-014. **Status:** reusable release gate pending implementation. **Owner:** RELEASE/QA/SEC. **Scope:** preview versus staging mutation evidence. **Review trigger:** next release review.
- **Lesson:** Test-module top-level guards are too late when Playwright webServer/plugins start during config load; sensitive environment validation must be shared and executed before `defineConfig`, with default-config early refusal. **Source:** E-015/P-018–P-020. **Status:** reusable security/release gate pending implementation. **Owner:** SEC/QA/RELEASE. **Scope:** credential-bearing Playwright runs. **Review trigger:** future sensitive E2E design.

## Consolidation boundary


## v5 post-review delta (2026-08-23T16:22:12Z)

### Candidate facts

- **Fact:** WP-05E correction-5 and WP-05F correction-6 are complete in the isolated v5 candidate only; task remains `in_progress`, R3/L2 and production NO-GO. **Source:** v5 checkpoint; E-016–E-020. **Status:** local candidate evidence, not production proof. **Owner:** Integration Lead/Owner.
- **Fact:** Reviewer packets report SEC v5 Local static PASS with old prelaunch High CLOSED, QA v5 PASS, Release v5 CONDITIONAL PASS to local candidate freeze, and reusable DATA v4 PASS because migration/data did not change. **Source:** E-017–E-020. **Status:** reviewer-reported evidence; external staging gates pending.
- **Fact:** Candidate provenance is writer v5 `035ed9...bada`, root v5 `65d611...d5d5`, 9 modified + 7 untracked / 16 authorized paths, HEAD at baseline, with no stage/commit/push/deploy/migrate/secret/DB action. **Source:** E-016. **Status:** candidate boundary only.
- **Fact:** QA's temporary pure-synthetic repo-local state was precisely deleted after the SEC stop and final state has no residue. **Source:** E-018/E-021. **Status:** cleanup evidence; no production data.
- **Fact:** Stable runbook/rollback/forward/config/guard/spec hashes are recorded in E-022; abbreviated values remain exactly as supplied and are not expanded. **Status:** candidate provenance.

### Department updates

- **SEC:** v5 packet closes the old prelaunch ordering High after local static checks; production authorization is unchanged. **Source:** E-017.
- **QA:** v5 PASS covers default/dedicated prelaunch failures, synthetic Node24 discovery for secret/legacy modes, negative fail-closed matrix and cleanup; real Node24/PostgREST mutation remains external. **Source:** E-018.
- **RELEASE:** v5 is conditional only for local candidate freeze; D3 staging and D4 production gates remain open. **Source:** E-019/E-023.
- **DATA:** v4 PASS is reusable because migration and data did not change; pgTAP 19/19 and real branch evidence are still required. **Source:** E-020/E-023.

### Decisions

- **Decision:** Keep status `in_progress`, production NO-GO; permit only a D3 request, then candidate freeze and bounded non-production staging under ≤4h/$0.054 if Owner approves. **Source:** v5 checkpoint and E-023. **Owner:** Owner/Integration Lead.
- **Decision:** Do not create a paid branch, run real mutation, migrate, deploy, or change `.env.example` without D3 and the exact external gates. Production remains separate D4. **Source:** TASK/HANDOFF/checkpoint.

### Lessons

- **Lesson:** A clean local prelaunch guard matrix can close a runner-ordering finding without proving branch-backed real mutation; candidate freeze, staging, recovery and production approvals remain separate evidence layers. **Source:** E-017–E-023.

### Consolidation boundary

Do not promote v5 local-candidate facts to long-term project/department memory until D3 staging, real mutation, rollback/re-forward, recovery evidence, release observation and Owner D4 approval are complete.

## Node22 validation delta (2026-08-23T16:37:42Z)

### Candidate facts

- **Fact:** `WP-20260823-002-NODE22-VALIDATE` completed under real Node `v22.12.0` / npm `10.9.0` with writer v6 packet `fa9fcb2e4e573c2dcae7ba82988c22a64043681f5c4542e16d200948ce4c12ad`. Typecheck, changed-file ESLint, full Vitest (454 files/3,002 tests), network-permitted build (30/30 pages), and Node24-gate prelaunch failure with marker absent were reported PASS; fixtures were removed. **Status:** local toolchain evidence only.
- **Fact:** Candidate remains 16 authorized paths at baseline HEAD/merge-base; diff check, historical migration, whitespace and stable hashes remain stable; only ignored `.next`/`playwright-report` exist; no source/secret/DB/staging/commit/push/deploy change occurred. Cached Node `24.15.0` is explicitly not Node24 evidence before D3.
- **Fact:** Owner D3 remains unapproved for candidate Git action, ≤4h/$0.054 branch, non-production keys, real Node24, pgTAP 19/19, both credential modes, rollback/re-forward and Vercel; exact backup/PITR and D4 remain missing. The same authorization blocker has recurred in the original Owner turn and two continuations. **Status:** blocker; main thread owns blocked-audit status decision.

### Decisions / lessons

- **Decision:** Keep task `in_progress`, production NO-GO; do not create a branch or run Node24/real mutation/staging before D3. The Node22 cache/toolchain result cannot satisfy the Node24 contract.
- **Lesson:** A full Node22 local suite and build validates source/toolchain compatibility but cannot replace Node24 prelaunch, branch-backed PostgREST, rollback/re-forward, recovery or production approval evidence.

### Consolidation boundary

Do not promote Node22 local validation to long-term release memory until D3 staging, Node24/real mutation, rollback/re-forward, exact backup/PITR, release observation and Owner D4 approval are complete.

## Owner D3 approval / resume delta (2026-08-23T21:39:51Z)

### Facts

- **Fact:** Owner explicitly approved a staging-only D3 rehearsal: local candidate commit, necessary non-production push, temporary Supabase branch capped at 4 hours/$0.054, real Node24 build, pgTAP, both key modes, rollback/re-forward and Vercel Preview; production release is excluded. **Status:** confirmed approval; v8 packet/lease/freeze and execution evidence pending.
- **Fact:** D3 unlocks branch credentials and staging-only migration/pgTAP/secret+legacy E2E, new-timestamp rollback/fresh re-forward, Vercel Preview and cleanup. It does not authorize production migration/deploy/promotion/canary/store, production key inspection/change, historical POST replay or destructive production SQL. **Status:** binding boundary; D4 separate.
- **Fact:** Official documentation states branches are independent with no production data and independent credentials; elevated secret keys are backend-only/service_role and legacy service-role keys coexist. **Source:** https://supabase.com/docs/guides/getting-started/api-keys. **Status:** documentation fact only; no values recorded.

### Decisions

- **Decision:** Preserve R3/L2 and `in_progress`/production NO-GO. Resume sequence is v8 packet → integration lease → candidate freeze → bounded D3 staging rehearsal → cleanup/evidence.
- **Decision:** Do not infer lease, staging success, Node24 evidence, migration application or release from Owner approval alone; D4 remains required for production.

### Consolidation boundary

Do not promote D3 approval to release completion until the v8 packet/lease, candidate freeze, branch TTL/cost, Node24, pgTAP, both key modes, rollback/re-forward, Vercel, cleanup, backup/PITR and Owner D4 gates are evidenced.

## D3 candidate-freeze correction delta (2026-08-23T21:52:28Z)

### Fact and bounded authorization

- **Fact:** candidate precommit `git diff --cached --check` found one `new blank line at EOF` at `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql:236`; identity, baseline, exact-16-path, known-hash, historical-migration, whitespace/untracked and secret-scan checks otherwise passed. **Source:** E-029. **Status:** confirmed precommit hygiene finding; no external mutation.
- **Decision:** authorize the same Luna writer, same isolated worktree and same WP to remove only that final blank line from the rollback artifact (no SQL semantic/content change), and update only the rollback SHA reference in the runbook. **Source:** P-026. **Status:** bounded correction pending; all other paths forbidden.
- **Gate:** before candidate commit, regenerate the hash, prove exact uncommented historical function+ACL equality, prove the artifact remains inert/all-comment, rerun cached diff check, and obtain DATA/SEC re-review. **Status:** required evidence, not completed.
- **Boundary:** production remains NO-GO; no DB, secret, push, deploy, historical POST replay or production store action is authorized. Keep task-memory sources below the packet cap.

### Consolidation boundary

Do not promote this EOF-only correction to release completion until the regenerated hash, exact function/ACL comparison, inert artifact proof, cached check and DATA/SEC re-review are recorded; D3 staging and D4 production gates remain separate.

## D3 candidate freeze delta (CAS v3, 2026-08-23T22:04:59Z)

### Confirmed candidate facts

- **Fact:** `WP-20260823-002-D3-CANDIDATE-FREEZE` completed CAS v3 under root v9 packet `aab140...d254` and writer v9 packet `7cffdb...f9f8`. DATA v9 `df43c9...8d66` and SEC v9 `6edd51...83af` both PASS. **Status:** candidate-freeze evidence only; production remains NO-GO.
- **Fact:** local branch `codex/store-signup-repair-20260823` is commit `871d2ca9ef8de6af056001454d66b082a1ac7e0d`, tree `df6862f4f820b35a18434d7585e84f39cdd78778`, single parent/base `7b47c0afcb2bea5f1069553555c701bc75549d46`; exact 16 paths, clean worktree/index and commit diff check PASS. **Source:** E-030.
- **Fact:** rollback SHA is `4ee9dae7a6d91cec62d20808c16aa2ca0b74c0f821fa0f71110875c38e4bcc75`; runbook SHA is `8f5d6cf3988163ab70c56a5ce82feec96d2c165a95bc504c85ba262a712937c3`; forward/pgTAP/historical migration unchanged. **Source:** E-031.
- **Fact:** no push, Supabase branch creation, DB, secret or deploy action occurred. Branch quote is `$0.01344/hour`, max four hours `$0.05376`; branch is not yet created. Integration lease v2 is current.

### Decision and next gate

- **Decision:** mark D3 candidate freeze complete, retain `in_progress`/R3/L2 and production NO-GO; proceed only to instruction v10/packets, cost confirmation, bounded non-production branch creation with TTL, and staging WP evidence. **Source:** E-030/E-031/P-027.
- **Boundary:** candidate freeze is not staging success or release authorization. D4 remains required for any production migration/deploy/promotion/canary/store action.

### Consolidation boundary

Do not promote the candidate freeze to release completion until instruction v10/packets, branch TTL/cost, Node24, pgTAP, both key modes, rollback/re-forward, Vercel, cleanup, recovery and subsequent Owner gates are evidenced.

## D3 branch-provision fail-closed delta (2026-08-23T22:09:22.949752Z)

### Facts

- **Fact:** writer v10 packet `733f9b38...58b4` was verified; candidate `871d2ca9...7e0d` was clean; exact branch cost `$0.01344/hour` was confirmed. **Source:** E-032.
- **Fact:** pre-list was empty. Branch `store-signup-repair-d3-871d2ca9`, id `8b387cc7-c951-4825-8a12-4c0602a9fa4b`, project ref `tmdebsvqvcrkburxyshp`, was created at `2026-08-23T22:09:22.949752Z` with hard deadline `2026-08-24T02:09:22.949752Z`; read-only lineage then found only three migrations through `20260518150000`, not expected marker `20260810173610`, and the candidate migration was absent. **Source:** E-032/E-033.
- **Fact:** branch was immediately deleted by exact id; post-list showed production main only and branch absent. No DDL/DML, test user/key persistence, push, Vercel, deploy or production action occurred; no branch or further cost was retained. **Status:** confirmed fail-closed attempt, not staging PASS.

### Decision and blocker

- **Decision:** retain `in_progress`, R3/L2 and production NO-GO. Treat WP branch provision CAS v3 as fail-closed and do not pay/retry until instruction v11 read-only branch-action/lineage investigation identifies the cause and a safe method. **Source:** P-028.
- **Next:** issue/verify v11 packets, investigate read-only branch action and lineage parity, then request any separate bounded retry only after cost/TTL and lineage safeguards are re-confirmed. D4 production remains separate.

### Consolidation boundary

Do not promote this attempt to staging success or release evidence. The absence of retained branch/cost is a safety outcome, while production remains NO-GO.

## v11 read-only lineage investigation delta (2026-08-24 projection)

### Confirmed facts

- **Fact:** writer v11 packet `57577b4d...9044` was verified; lineage investigation CAS v3 ran against clean candidate `871d2ca9...7e0d`. **Status:** read-only investigation evidence; no staging/production claim.
- **Fact:** production `list_migrations` and direct ledger each count 119, first `20260213234620`, latest `20260810173610`; repo candidate contains 121 timestamped files. Repo-only drift is `20260806222149`, `20260807120000`, `20260807120100`, `20260823141758`; production-only drift is `20260804225445`, `20260804230127`. **Status:** version-name drift confirmed; object-level parity not yet proven.
- **Fact:** deleted branch exposed only three migrations through `20260518150000`; branch `get_project` is not found and branch-action logs are empty; exact cause is unproven. CLI 2.101.0 help-only inspection showed official branch create and optional `--with-data`; no operation was invoked.

### Decision and next gate

- **Decision:** same-method paid retry remains NO-GO. Keep `in_progress`, R3/L2 and production NO-GO; no push, branch, candidate/source mutation, secret, DB, DDL/DML, test user/key persistence, Vercel or deploy action.
- **Next:** DATA/INT object-level reconcile the five pre-candidate drift versions and determine whether an official GitHub/CLI data-less branch path can be used without candidate/source mutation. Only after review may a separate bounded retry be considered.

### Consolidation boundary

Do not treat version counts, help output or deleted-branch observations as exact root cause or staging parity. The full pre-v11 EVIDENCE source is retained in `EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md`; live evidence is compacted solely for packet size.
