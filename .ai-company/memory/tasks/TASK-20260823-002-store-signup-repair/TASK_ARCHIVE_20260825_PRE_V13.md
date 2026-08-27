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
updated_at: "2026-08-23T22:52:21Z"
---
# Task — 修复 RepairDesk 店铺注册失败并完成安全发布

## Current objective

Restore self-service creation of an independent store while preserving tenant isolation, service-role-only execution, atomicity, idempotency, rate limiting, safe error handling, observability, and a reversible production release.

Owner authorized bounded implementation/test work and a reversible forward-release plan after all gates. This does not authorize secret access or exposure, historical POST replay, real production store/account creation or deletion, destructive cleanup/SQL, migration, deployment, or public/customer communication before the required Owner/DATA/SEC/QA/Release gates.

## Security and production boundary

- The RPC remains service-role-only: revoke `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`. Preserve `SECURITY DEFINER`, empty `search_path`, actor and verified-email checks, tenant isolation, validation, atomicity, idempotency, and rate limiting.
- Do not replace layered BFF/auth/email checks with `current_user = 'service_role'` inside the definer function, and do not expose the RPC to browser roles.
- Do not inspect, print, commit, screenshot, or persist secrets, tokens, sessions, full customer PII, or production payloads.
- Do not replay the four historical failed POSTs, create/delete a real production store, purge data, run destructive SQL, migrate, deploy, or change production configuration without the matching approval record.
- Do not edit the historical migration `20260724114500_atomic_store_onboarding.sql`; do not alter unrelated schema, RLS, tenant predicates, ledger retention/FK, `store_code` uniqueness, purge-GUC checks, or onboarding flows.
- The shared worktree is dirty/diverged and is not a valid business-code write location; implementation requires a clean isolated worktree.

## Packet-size correction / archive

- `TASK_ARCHIVE_20260823_PRE_WP05E.md` is the mechanically preserved pre-correction TASK.md snapshot. Superseded baseline/facts, original scope/change budget, and WP-00–WP-05D planning/history remain there.
- This is a context-packet size correction only: semantics, status, approvals, safety boundaries, and pending gates are unchanged. No repair, test pass, migration, deployment, or production claim is made.

## Current dependency and next-step index

- **WP-00–WP-05D:** prior plans and reviewer history are archived; their prerequisites and evidence remain required, but none is newly claimed complete by this compaction.
- **WP-05E correction-5 / WP-05F correction-6:** completed in the isolated v5 candidate; SEC v5 local static PASS/old prelaunch High CLOSED, QA v5 PASS, and Release v5 CONDITIONAL PASS to local candidate freeze. This is not a production repair or release claim.
- **D3 staging-only approval/freeze:** Owner approved the bounded D3 rehearsal; candidate freeze CAS v3 completed under lease v2, while the first branch attempt failed closed and was deleted. v11 lineage investigation and v12/lease v4 Node24 build are recorded; full production-parity staging is NO-GO, and the next decision is Owner choice between lineage reconciliation first or limited candidate-schema rehearsal. This does not authorize production.
- **WP-06 (blocked/NO-GO):** controlled production migration/deploy/canary/promotion/store creation only after all release gates and explicit Owner D4 approval.
- **WP-20260823-002-NODE22-VALIDATE:** completed Node22 validation in the candidate; this adds local toolchain evidence only and is not Node24 or staging evidence.
- **Next action:** under lease v4, obtain Owner direction: recommended lineage-reconcile first then re-freeze/full D3, or limited candidate-schema signup static rehearsal now (conditional only, not parity/release evidence). Do not retry branch/push/Vercel or run production mutation without review; D4 is separate.

## Archive and evidence index

- Archive: `TASK_ARCHIVE_20260823_PRE_WP05E.md` (pre-WP05E snapshot; raw historical text preserved).
- Checkpoint archive: `CHECKPOINTS_ARCHIVE_20260823_PRE_COMPACTION.md` (pre-compaction `CHECKPOINTS.md`, byte-faithful; live checkpoints are a compact projection below the 28,000-byte packet-source cap).
- Evidence archive: `EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md` (pre-v11-lineage `EVIDENCE.md`, byte-faithful; live evidence is a compact ID-preserving projection below the 28,000-byte packet-source cap).
- Current evidence/hand-off remain in `EVIDENCE.md` and `HANDOFF.md`; current checkpoints and this correction are recorded in `CHECKPOINTS.md`.
- Current status is `in_progress`, R3/L2, production NO-GO. A passing local check cannot advance status or authorize production.

## v5 post-review state (local candidate; production NO-GO)

- WP-05E correction-5 and WP-05F correction-6 are recorded as completed in the isolated candidate only. SEC v5 packet `64ef52...4048` is Local static PASS and closes the old prelaunch High; QA v5 packet `f2bf54...725ca` is PASS; Release v5 packet `92bdae...1d24` is CONDITIONAL PASS to local candidate freeze; DATA v4 PASS is reusable because migration/data did not change.
- Candidate provenance: writer v5 SHA `035ed9...bada`, root v5 SHA `65d611...d5d5`; candidate reports 9 modified + 7 untracked across 16 authorized paths. HEAD remains baseline; nothing was staged, committed, pushed, deployed, migrated, or connected to secrets/DB.
- QA reports a short-lived synthetic repo-local state was created for the guard checks, then precisely deleted after SEC stop; final state has no residue and this does not weaken the QA PASS.
- Stable artifact hashes are recorded in `EVIDENCE.md`: runbook `d1a5de56c22c9f98909f9c6ddff57e3d9fa80495e9b16da8d0da7e6e307f708e`, rollback `f4c12d553e719ac05c49b022b6879b0c91fbf45bdc9dd58648a7f505fd9527e0`, forward `1a55e5e8af78ccb20f23d1e046cdc2c76b160b9e571e4c27965043c7b368c8e1`; global config `c5dbee5b...9c012`, dedicated config `07914a3b...27ba`, guard `8176ae1a...e20`, spec `e0681a71...88fd`.
- D3 approval is recorded for candidate commit, necessary non-production push, a temporary branch ≤4h/$0.054, branch credentials, real Node24, staging migration/pgTAP, secret+legacy E2E, new-timestamp rollback/fresh re-forward, Vercel Preview and branch cleanup. Execution gates remain open until v8 packet/lease/freeze and evidence are recorded; production remains a separate D4 gate.

## Owner D3 approval / resume contract (staging-only; production NO-GO)

- **Owner approval (verbatim):** `批准 D3 staging-only 演练：允许本地候选提交、必要的非生产 push、最长 4 小时且最高 $0.054 的 Supabase 临时分支、真实 Node 24 构建、pgTAP、两种 key 测试、rollback/re-forward 和 Vercel Preview；不包含生产发布。`
- **Risk/authority:** task remains R3/L2 and `in_progress`. D3 permits only the listed staging rehearsal actions; it does not authorize production migrate/deploy/promotion/canary/store creation, production key change/inspection, historical POST replay or destructive production SQL. D4 is a separate approval.
- **D3 unlocks:** local candidate commit, necessary non-production push, temporary branch ≤4h/$0.054, independent branch credentials, real Node24 build, staging migration/pgTAP/secret+legacy E2E, a new-timestamp rollback followed by fresh re-forward, Vercel Preview and branch cleanup.
- **Official non-production facts:** Supabase branches are independent, contain no production data, and use independent credentials; elevated secret keys are backend-only and map to `service_role`, while legacy service-role keys coexist. Reference only the official [Supabase API keys documentation](https://supabase.com/docs/guides/getting-started/api-keys); no key value is stored here.
- **Resume gate:** issue/verify the v8 packet, acquire/verify the integration lease, freeze the candidate, then run the D3 checklist. Do not infer a lease, staging success, Node24 evidence, migration application, or release from this approval alone.

## D3 candidate-freeze correction — cached EOF whitespace only (2026-08-23T21:52:28Z)

- **Finding:** candidate precommit `git diff --cached --check` found one `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql:236` `new blank line at EOF`; identity, baseline, exact-16-path boundary, known hashes, historical-migration, whitespace/untracked and secret-scan checks otherwise passed.
- **Bounded authorization:** the same Luna writer, same isolated worktree and same WP may write only `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` to remove that single final blank line (no SQL semantic/content change) and `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` only to update the rollback SHA reference. No other path is authorized.
- **Required re-evidence before commit:** regenerate the rollback hash; prove exact uncommented historical function plus ACL equality; prove the artifact remains inert/all-comment; rerun cached diff check; obtain DATA/SEC re-review. This is a candidate hygiene correction, not an implementation, migration, deploy or production claim.
- **Boundary:** production remains NO-GO; no DB, push, deploy, secret inspection/change, historical POST replay or production store action is authorized.

## D3 candidate freeze completed — CAS v3 (2026-08-23T22:04:59Z)

- **Evidence:** E-030/E-031 record root/writer v9, DATA/SEC PASS, CAS v3 commit/tree, exact 16 paths, clean worktree/index, regenerated hashes, unchanged forward/pgTAP/history, cost quote and lease v2.
- **Boundary:** candidate freeze only; no push, branch, DB, secret, deploy or production action. See the later fail-closed branch and v11 lineage sections; production remains NO-GO.

## D3 branch-provision attempt failed closed (2026-08-23T22:09:22.949752Z)

- **Evidence:** E-032/E-033 preserve writer v10, candidate/cost, empty pre-list, exact branch/ref/id/timestamps, three-migration lineage, exact-ID deletion and post-list absence.
- **Boundary/next:** fail-closed attempt, not staging PASS; no DDL/DML/user/key/push/Vercel/deploy/cost residue. Same-method paid retry is NO-GO pending v11 read-only investigation.

## v11 read-only lineage investigation completed (2026-08-24 projection)

- **Evidence:** E-034/E-035 preserve writer v11/CAS v3, production/repo counts, all five version-name drifts, deleted-branch/get_project/log observations and CLI help-only result.
- **Boundary/next:** exact cause and object-level parity remain unknown; same-method paid retry is NO-GO. DATA/INT must reconcile the five drift versions and review a safe official data-less branch path without candidate/source mutation; production remains NO-GO.

## v12 / lease v4 milestone projection (2026-08-24)

- **DATA drift reconcile:** packet `b35bbc2c5c85ede7306c7043504a9cf821f8133547f2303570dc1d75c45fb3d1`. Production-only `20260804225445`/`20260804230127` map to local-main aliases `20260804140252...`/`20260804225900...`; repo-only `20260806222149`/`20260807120000`/`20260807120100` are not in production. Local main `353fb0eb` has only SeaTable aliases; origin/main `e427c375`, deployed `7b47c0af`, candidate `871d2ca9` have toolkit/lifecycle; no ref has both. Full parity staging NO-GO; limited candidate-schema signup static is conditional only, not parity/release evidence. Reconcile/new migration changes the frozen candidate and needs Owner direction.
- **Node24 build:** `WP-20260824-002-D3-NODE24-BUILD` CAS v3, writer v12 `d44bf90bab938b21482df0bb5349a76319f46d60d8502368ad37dff4c10b05a6`; candidate `871d2ca9...` exact tree/parent/16 paths/clean. `/private/tmp/node-v24.19.0-darwin-arm64/bin/node` v24.19.0, npm 10.9.0, Next 16.2.11; font fetch failed network-only, authorized retry PASS 18s (TS, 30/30 pages). No secret/DB/server/browser/push/deploy/migrate/file change; only ignored outputs.
- **Decision/boundary:** lease v4; prior branch deleted/no retained cost; no second paid branch/push/Vercel. Owner chooses lineage-first or limited candidate-schema rehearsal; production NO-GO.

### WP-20260823-002-NODE22-VALIDATE — Node22 validation completed; D3 blocked

- **Packet:** writer v6 `fa9fcb2e4e573c2dcae7ba82988c22a64043681f5c4542e16d200948ce4c12ad`; real Node `v22.12.0` / npm `10.9.0`.
- **Local results:** typecheck PASS (~2s); changed-file ESLint PASS (~2s); full Vitest PASS (454 files / 3,002 tests, ~23s); first build failed only on sandbox Google Fonts, then network-permitted `npm run build` PASS (~17s), Next `16.2.11`/Turbopack, TypeScript and 30/30 pages; dedicated config under Node22 failed at the Node24 gate before launch with marker absent; fixtures removed.
- **Boundary:** candidate remains 16 authorized paths with HEAD/merge-base at baseline; diff check, historical migration, whitespace and stable hashes unchanged; only ignored `.next`/`playwright-report` exist; no source/secret/DB/staging/commit/push/deploy change. Cached Node `24.15.0` is not Node24 evidence because the contract forbids using it before D3.
- **Blocker:** Owner D3 is still unapproved for candidate Git action, ≤4h/$0.054 branch, non-production keys, real Node24, pgTAP, both credential modes, rollback/re-forward and Vercel; exact backup/PITR and D4 are also missing. The same authorization blocker has recurred across the original Owner turn and two goal continuations; the main thread owns the blocked-audit status decision. Task remains `in_progress`, production NO-GO.

### WP-05E — SEC v4 prelaunch-order correction contract (correction-5 complete locally; production NO-GO)

- **Trigger:** the 2026-08-23T15:49:09Z SEC v4 review found a High prelaunch-order blocker: Playwright `webServer`/plugin setup may execute before sensitive spec top-level guards. Current credential-bearing execution is forbidden until configuration-load guards run first.
- **Writer/worktree/state:** keep `in_progress`, R3/L2 and production NO-GO; use the same Luna writer in the same isolated worktree. WP-05E write allowlist is exactly: `playwright.config.ts` (only early sensitive-flag refusal and dedicated-config pointer), new `playwright.store-signup-postgrest.config.ts`, new `tests/e2e/support/atomic-store-onboarding-postgrest-env.ts`, `tests/e2e/atomic-store-onboarding-postgrest.spec.ts`, and `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md`. All other files are forbidden. `docs/STORE_SIGNUP_REPAIR_ROLLBACK.sql` remains read-only; no hash or SQL change is authorized by WP-05E.
- **Shared guard / no duplication:** `tests/e2e/support/atomic-store-onboarding-postgrest-env.ts` must provide one shared guard. The dedicated config must load and execute it before `defineConfig`; the spec must reuse it as a second defense and retain exact origin/POST/UUID/name assertions. The guard must fail closed at module/config load for Node 24, `requested=1`, exact loopback/base/command/`REUSE_EXISTING_SERVER=0`, `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` equality and ref binding, key mode, and every existing storageState/domain/non-production gate.
- **Dedicated config contract:** `playwright.store-signup-postgrest.config.ts` must hardcode `testMatch`, `workers: 1`, list reporter with no HTML reporter, validated storageState, `trace: off`, `screenshot: off`, `video: off`, and `webServer` command/url with `reuseExistingServer: false`. It must not inherit permissive global webServer/plugin behavior.
- **Default config refusal:** `playwright.config.ts` must inspect the sensitive flag during config load and, before any webServer or plugin setup, throw a safe refusal pointing to `--config=playwright.store-signup-postgrest.config.ts`. A default-config run with a malicious marker command must fail before command start and leave no marker.
- **Negative/positive matrix:** prove dedicated Node 20 fails before server start; synthetic Node 24 secret-key and legacy-key mode lists reach test discovery without exposing values; all negative guards fail closed. Keep Vercel Node 24 preview build/smoke separate and production-inaccessible from real mutation E2E.
- **Runbook command:** `docs/STORE_SIGNUP_REPAIR_RUNBOOK.md` may document only `--config=playwright.store-signup-postgrest.config.ts` for the sensitive E2E and must state that ordinary/default config refuses it. No `.env.example` change is permitted.
- **v5 disposition / hard no-go:** correction-5 is locally complete per SEC/QA/Release v5 packets, with no backend endpoint or production-source expansion, migration/DB/secret/deploy, production host/ref, real production POST/store, trace/screenshot/video artifact, or unlisted path. External D3/staging gates remain required; WP-06 remains blocked and production NO-GO.

### WP-05F — v5 reviewer follow-up / correction-6 (completed local candidate; production NO-GO)

- **State:** same Luna writer and isolated candidate completed the v5 follow-up. This records reviewer evidence, not a production fix or release.
- **SEC v5:** packet `64ef52...4048` Local static PASS; the old prelaunch High is CLOSED; the sensitive config/guard contract remains required at runtime and production is NO-GO.
- **QA v5:** packet `f2bf54...725ca` PASS with typecheck, changed-file ESLint, default-config list, default malicious-marker and dedicated Node20 prelaunch failures with marker absent, synthetic Node24 secret and legacy discovery count 1 each, all negative guards fail closed, and fixtures cleaned.
- **Release v5:** packet `92bdae...1d24` CONDITIONAL PASS to local candidate freeze only. DATA v4 PASS is reusable because migration/data are unchanged.
- **Remaining gates:** candidate commit/Git approval; Owner D3 branch ≤4h/$0.054; Node24 clean build; pgTAP 19/19; secret+legacy real E2E; forward→rollback→fresh re-forward; Vercel preview; exact backup/PITR; then separate Owner D4 production approval.


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
| SEC v4 prelaunch-order correction | Shared guard executes before dedicated `defineConfig`; default config early-refuses sensitive flag before webServer/plugin setup; dedicated config hardcodes testMatch/workers/list reporter/no HTML/storageState/trace-screenshot-video off/webServer command-url/reuse=false; Node20 fails prelaunch and synthetic Node24 secret/legacy modes reach discovery; default malicious marker never starts | SEC/QA/RELEASE | WP-05E/WP-05F; local v5 PASS, external D3/staging gates pending |
| Node22 candidate validation | Node 22.12.0/npm 10.9.0 typecheck, changed ESLint, full Vitest 454 files/3,002 tests, network-permitted build 30/30 pages, and Node24-gate prelaunch fail with no marker; no source/secret/DB/staging mutation | QA/INT | WP-20260823-002-NODE22-VALIDATE; completed local evidence, Node24/staging/D3 pending |
| Owner D3 staging-only approval | Verbatim Owner approval for candidate commit/necessary non-production push, ≤4h/$0.054 branch, independent branch credentials, Node24, pgTAP, both key modes, new-timestamp rollback/fresh re-forward, Vercel Preview and cleanup; production explicitly excluded | Owner/INT | D3 approved; v8 packet/lease/freeze and execution evidence pending; D4 production NO-GO |
| D3 candidate-freeze hygiene | Cached `git diff --cached --check` has one rollback-artifact EOF blank line; remove only that line, update only runbook rollback SHA, regenerate hash, prove exact function/ACL equality and inert all-comment artifact, rerun cached check, obtain DATA/SEC review | INT/DATA/SEC | Same writer/worktree/WP; precommit correction pending; production NO-GO |
| D3 candidate freeze completion | CAS v3 candidate commit/tree, exact 16 paths, clean worktree/index and commit diff check; rollback/runbook hashes regenerated; DATA v9 and SEC v9 PASS; forward/pgTAP/historical migration unchanged | INT/DATA/SEC | WP-20260823-002-D3-CANDIDATE-FREEZE completed; no push/branch/DB/secret/deploy; staging WP pending |
| D3 branch provision fail-closed | Verified writer v10/candidate/cost; empty pre-list; exact non-prod branch create/deadline/project ref; read-only lineage mismatch; exact-ID deletion and post-list absence; no DDL/DML/user/key/push/Vercel/deploy/cost residue | INT/DATA/RELEASE | WP branch-provision CAS v3 fail-closed; not staging PASS; v11 read-only investigation and safe retry method pending |
| v11 lineage investigation | Production list/ledger 119 vs repo 121 timestamped files; five drift versions reconciled at version-name level; deleted branch/get_project/log observations; CLI 2.101.0 help-only; exact cause and safe data-less branch method remain unknown | DATA/INT | WP lineage investigation CAS v3 completed; object-level reconciliation and any retry approval pending; no push/branch |
| v12 DATA drift reconcile / Node24 build | DATA packet and alias/tree drift evidence; full parity NO-GO, limited candidate-schema static conditional GO; Node24.19/npm10.9 build PASS after authorized font retry with TS/30 pages and clean exact candidate | DATA/INT/QA | Lease v4; Owner direction required before any candidate/source migration or paid branch; production NO-GO |


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
