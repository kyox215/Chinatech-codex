# Checkpoints — TASK-20260823-002-store-signup-repair

## Packet identity and checkpoint rules

- **Runtime identity (verified in the supplied packet):** project `repairdesk-chinatech`; task `TASK-20260823-002-store-signup-repair`; run `RUN-20260823-002-IMPLEMENT-001`; window `WINDOW-01A02EC5-STORE-SIGNUP-REPAIR`; initial packet v1 SHA-256 `1460e7cc01fc85f0ec7e56b0a2a30d2b90ef92e56be75a638498e6bbf276c2a6`.
- **Coordination:** supplied Registry doctor was healthy and no integration lease was held. Binding is identity evidence only; it grants no code, worktree, commit, push, migration, deploy, secret, staging or production authority.
- **Current:** closed after the final 60-minute read-only release gate; E-064/P-050 superseded; E-065/P-051 completed through E-068/P-054; main/production release evidence recorded.
- **Worker boundary:** this writer may update only the five live task-memory files. Do not run checkpoint CLI or mutate Registry/`ACTIVE_CONTEXT.md`; do not touch business files, secrets, database, migration, deploy, real account/store or production data.
- Later checkpoints must separate confirmed facts, inference, unknowns, approvals and plans. Historical detail is retained in EVIDENCE.md/HANDOFF.md and the applicable byte-faithful archives; this live file is a compact projection.

## Historical implementation/security pointer (2026-08-23/24)

E-005–E-026/P-001–P-030 cover the normalized R3 contract, WP-05 corrections, Node22 validation, security corrections, Owner-approved D3 staging-only scope, candidate freeze/branch failure, v11/v12 lineage and Stage-A DATA design. D3/production stayed gated; no production mutation. Details: EVIDENCE.md and byte-faithful archives.

Archive: CHECKPOINTS_ARCHIVE_20260823_PRE_COMPACTION.md; EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md; TASK/HANDOFF/MEMORY_DELTA archive pointers.
## Evidence pointer index

- Confirmed root cause/error/test/security facts: E-002–E-012.
- Reviewer correction trigger and contracts: E-013–E-015; acceptance P-010–P-017.
- v5 local review packets and candidate boundary: E-016–E-023; acceptance P-018–P-023.
- Node22 local validation and historical D3 blocker: E-024–E-026.
- Owner D3 approval and official branch/key semantics: E-027–E-028; acceptance P-024–P-025.
- Candidate freeze CAS v3 and regenerated artifact/review evidence: E-030–E-031; acceptance P-027. Current lease v2; staging branch is not yet created.
- Branch-provision fail-closed attempt and lineage blocker: E-032–E-033; acceptance P-028. Branch was deleted; no staging PASS.
- v11 lineage investigation: E-034–E-035; version-name reconciliation is not object-level parity and exact cause remains unknown.
- v12 DATA reconcile / Node24 build: E-036–E-037; full production-parity staging NO-GO, limited candidate-schema static conditional only, Node24 build PASS.
- v13 Owner D3-A / lineage-design intake: E-038–E-039; P-030–P-031; Stage-A design was pending at intake and no active lease was held.
- v13 DATA design GO: E-040–E-041; P-032–P-033; exact 17-path implementation contract registered, no implementation or staging claim.
- v14 lineage implementation: E-042–E-043; P-034; exact 17-path dirty candidate, 120/120 static lineage and local validation PASS, no freeze/staging/production claim.
- v15 independent review / Plan Delta: E-044–E-045; P-035; required LF/provenance/runbook/path18 blockers, no-freeze and Owner gate.
- Owner path18 approval: E-046; P-036; exactly 18-path bounded correction, no other path or production action.
- v16 correction: E-047; P-037; exact 18-path snapshot and local validation PASS, full suite/build reused.
- v17 review/Plan Delta: E-048; P-038; local freeze FAIL/NO-GO with six bounded blockers; v18 correction and four re-reviews are next.
- v18 correction: E-049; P-039; exact 18-path local correction and targeted Node24/18-test checks PASS; v19 four re-reviews are next.
- v19 four-review result: E-050; P-040; DATA/SEC/QA/Release local PASS/GO TO FREEZE ONLY; ordinary commit X, clean lineage/tree, integration/remote, data-less branch and real tests remain pending.
- v19 post-freeze commit X: E-051; P-041; staged exact 18, narrow EOF exception, ordinary X and clean tree/index PASS; v20 confirmation/prechecks are next.
- SEV-2 security pause: E-052; P-042; D3 is stopped pending Owner action-time confirmation of OAuth grant revocation, global Dashboard session termination, audit and clean MFA recovery.
- P-042 recovery result: E-053; OAuth/session recovery, audit and clean GitHub+MFA re-entry were verified. P-042 is Satisfied/verified; only v20/approved non-production D3 may resume.
- v20/D3: E-054–E-065; P-043 pending; P-048 executed with Preview deviation; P-049/P-050 superseded; P-051 authorized with gates pending; main/production NO-GO; P-044–P-047 historical/satisfied.

## 2026-08-26T13:55:54+02:00 — P-042 security recovery verified / P-043 opened

- **Recovery/E-053/P-042:** OAuth revocation, five-token destruction, bounded audit and clean GitHub+MFA re-entry were verified; one TOTP factor remains and backup-factor risk is open. Details remain in EVIDENCE.md.
- **Boundary:** P-042 is **Satisfied/verified**; only v20 QA/Release, Supabase/Vercel/root prechecks and approved non-production D3 may resume; production migration/deploy/canary/store remains **NO-GO**. No mutation occurred; re-verify packet/lease before each material step.
- **E-054–E-056:** production 119/repair absent/old RPC failures; candidate QA conditional; Release/INT fail with remote ref/Vercel/PITR unresolved; no write. Details remain in EVIDENCE.md.

## Resume / stop conditions

- **Next:** Owner decides retain/delete Preview; until decided no Vercel/DB/D3/production action; main/production NO-GO.
- **Stop:** if identity, packet, lease, lineage, non-production boundary, cost/TTL, credentials, Node24, pgTAP, rollback/re-forward, Vercel preview or backup/PITR evidence is missing, stop before staged mutation.
- **Production:** no production migrate/deploy/promotion/canary/store, key inspection/change, historical POST replay or destructive SQL without Owner D4 and a matching packet.

## Archived earlier stable checkpoints (2026-08-23 through 2026-08-26)

The original checkpoint text for the early D3 candidate-freeze, lineage, review, v18/v19 and security-gate period (former lines 53–133) is preserved verbatim in [CHECKPOINTS_ARCHIVE_20260827_PRE_RELEASE.md](CHECKPOINTS_ARCHIVE_20260827_PRE_RELEASE.md). The main file intentionally retains the v22–v29 release gate and all 2026-08-27 release, immediate, 15-minute, 30-minute and 60-minute observation checkpoints below.



## 2026-08-27 — v22–v29 migration-first release gate; E-059–E-065/P-046–P-051

- E-059: 3 read-only preflights: main NOW NO-GO/CONDITIONAL; origin/main=`e427c375…`; X FF only unchanged; main..X=4 commits/162 paths (131 outside signup); dirty main=`353fb0eb` diverges with 3 SeaTable commits absent—never push. Main unprotected/no checks; Vercel historical main→production, trigger unknown; prod DB=119, `20260823141758` absent, old RPC=5 failures; no auto-migrate; Supabase GitHub prod integration/backup/PITR unknown; push cannot fix; production/code-DB sequencing risk; no push/deploy/DB/POST.
- E-060/P-046 **Satisfied**: Owner `确认` confirmed `确认先推非生产候选分支`; exact non-production X→ref only, fetch SHA/tree; retry governed by E-062/P-048.
- E-061/P-047 **Satisfied**: v23 packet/lease + candidate lineage/clean/origin/ref-absent PASS; DNS blocked push; retry rejected: `确认` lacked same-message repo+commit+ref. Ref absent; no fetch/write; force/main/tag/ref-delete/deploy/promote/Supabase/DB/POST/store excluded.
- E-062/P-048 **Executed; downstream deviation**: v26 packet `492feaf2...58f95`/lease v18; prechecks+ref absent PASS. Sandbox DNS blocked ordinary push; identical elevated network push created `refs/heads/codex/store-signup-repair-20260823`. ls-remote/fetch verified X=`105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc`, tree=`d3510de9a1f951dbb5e1e369da7517e22e1973ec`; candidate clean; origin/main=`e427c3751f8c8ef0d6533ee15424676a61348a4d`. No force/tag/ref-delete/main push/manual deploy/promote/Supabase/DB/POST/store/secret.
- E-063/P-049 **Verified; Owner decision pending**: read-only Vercel Git integration auto-created Preview `dpl_8Urvbzc6iF84wUpu5gvwKjUzBTxR` (git/null/READY, branch+commit=X); production remains `dpl_48HThuaNdK7QbhSma3REppSG4LwC`/`7b47c0af...`, not promoted. It conflicts with Owner “不部署”; no delete/cancel tool or authorization, so retained. Owner chooses retain for later D3 or explicitly authorizes deletion; until then no Vercel/DB/D3/production action; main/production NO-GO.
- E-064/P-050 **Superseded by E-065/P-051**: prior D4 choice was blocked; main/production NO-GO and Preview/backup/PITR evidence remain.
- E-065/P-051 **Owner-authorized; gates pending**: `设置目标并修复所有问题 直到可以创建店铺 ，解决所有问题。完成后推送并部署` created an active objective and supersedes P-050; migration-first authorizes required D3, reviewed production function migration, ordinary main push and Vercel production deploy (R4/L1/D4). No force/tag/ref-delete, historical rewrite/repair/with-data, irreversible deletion, secret/PII/customer communication, paid PITR/add-on or data-bearing production POST; prefer rollback-only/zero-residue canary and stop on lineage/ACL/RLS/auth/tenant/backup/remote-SHA deviation. Status `in_progress / owner-authorized-migration-first-recovery-and-release`; production write only after gates. Next: live baseline→D3→independent DATA/SEC/QA/Release→prod 119→120→main/Vercel→15/30/60; production NO-GO until passed.
## 2026-08-27T07:55:00Z — D3 read-only diagnosis: branch ledger remains 3/latest 20260518150000; stale UUID FK failure reproduced against customers.id text; candidate X worktree is clean with current text CRM migration.

- **Phase:** D3-V30-verify
- **Completed/current state:** D3 read-only diagnosis: branch ledger remains 3/latest 20260518150000; stale UUID FK failure reproduced against customers.id text; candidate X worktree is clean with current text CRM migration.
- **Next:** Integration Lead: stop this failed branch; verify exact X/tree and CRM migration SHA, then provision a fresh data-less D3 branch from the approved lineage before any migration/E2E gate.
- **Decision:** Do not apply SQL to the failed branch; require fresh branch provenance and reject any artifact whose CRM customer_id is uuid.
- **Blocker:** Branch-management permission is unavailable and production is forbidden; no branch recreation or migration application was performed.
- **Evidence:**
  - D3 read-only ledger query: 3 migrations, latest 20260518150000; target 20260518170000 absent.
  - D3 postgres log and BEGIN/ROLLBACK reproduction: PostgreSQL 42804, uuid customer_id incompatible with text customers.id; rollback left no relation residue.
  - Candidate X target migration SHA-256 173a53c531342883bf7dc5ae3506ec12871cb4f3ecf0240e1fb762c302879906; candidate status clean; local scoped Vitest 21/21 passed.
- **Recorded by:** WORKER-LUNA-D3-V30
## 2026-08-27T08:10:48Z — D3 follow-up: production ledger is 119 and candidate is 120; ledger diff is exactly 20260823141758. Prepared an unexecuted BEGIN/DO/ROLLBACK verification covering function metadata, ACL, compile/runtime, transactional create/replay/conflict/FK rollback and zero residue.

- **Phase:** D3-V30-verify
- **Completed/current state:** D3 follow-up: production ledger is 119 and candidate is 120; ledger diff is exactly 20260823141758. Prepared an unexecuted BEGIN/DO/ROLLBACK verification covering function metadata, ACL, compile/runtime, transactional create/replay/conflict/FK rollback and zero residue.
- **Next:** Integration Lead: apply the provided SQL only after the reviewed signup migration is applied in the approved environment; record pass/fail without printing actor identifiers, then continue Node24 loopback E2E and release gates.
- **Decision:** CLI dry-run remains unavailable without a linked project or local Postgres; MCP read-only ledger comparison is the evidence for the single pending migration. Do not run backups CLI or Vercel env listing without credentials/link.
- **Blocker:** Backups list stopped for missing SUPABASE_ACCESS_TOKEN; candidate has no .vercel link; no secrets were read and no production write/POST occurred.
- **Evidence:**
  - Production metadata read-only: function exists, PL/pgSQL, SECURITY DEFINER, search_path empty, anon/authenticated EXECUTE false, service_role EXECUTE true, legacy claim gate still present before signup migration.
  - Production migration ledger 119/latest 20260810173610; candidate migration filenames 120; set difference exactly 20260823141758.
  - Candidate tracked dedicated Playwright config exists; --list without explicit gate fails closed by design, not missing-file drift.
- **Recorded by:** WORKER-LUNA-D3-V30
## 2026-08-27T08:26:29Z — Created only /private/tmp/repairdesk_store_signup_preflight_rollback_v30.sql via apply_patch; exact candidate 20260823141758 embedded; synthetic .invalid auth actor; no SQL executed.

- **Phase:** D3 V30 preflight artifact
- **Completed/current state:** Created only /private/tmp/repairdesk_store_signup_preflight_rollback_v30.sql via apply_patch; exact candidate 20260823141758 embedded; synthetic .invalid auth actor; no SQL executed.
- **Next:** Parent reviews preflight artifact and decides whether to create postapply/postcheck artifacts.
- **Evidence:**
  - /private/tmp/repairdesk_store_signup_preflight_rollback_v30.sql sha256=7c0d884fbf8131aa252cf1c6dc99b1972745e8ad9bd0fcaf1f330cfdb08a2eba; embedded migration sha256=1a55e5e8af78ccb20f23d1e046cdc2c76b160b9e571e4c27965043c7b368c8e1; begin/rollback transaction lines 1/1; exact comparison true
- **Recorded by:** WORKER-LUNA-D3-V30
## 2026-08-27T11:51:52Z — Emergency runtime key-compatibility checkpoint

- **Phase:** production runtime recovery / owner authorization
- **Completed/current state:** Owner saw the exact credential-priority risk and replied `继续`, explicitly approving the backward-compatible server-only policy: trimmed nonblank `SUPABASE_SERVICE_ROLE_KEY` wins when both variables exist; trimmed `SUPABASE_SECRET_KEY` is the fallback only when legacy is absent/blank; no key fails closed. Approval covers the two-file code/test patch, ordinary non-force main push, and redeployment.
- **Repository:** candidate HEAD `626d3df4245d100662fea776f5550412ef5c7953`; worktree clean at checkpoint time. The patch is not implemented or tested yet.
- **Production evidence:** `dpl_2XB...` used the secret-key path and produced `401 Invalid API key` for the same account path, then was rolled back. Formal domain is on READY stable `dpl_48H...`; that path returned 200 at `2026-08-27T11:34:00Z`, with Computer Use showing account opened.
- **Database:** migration and canary remain healthy; no DB rollback is authorized or needed for this runtime issue.
- **Next:** modify only `src/server/supabase.ts` and `src/server/supabase.test.ts`; run focused Vitest, lint, typecheck and `git diff --check`; stop before stage/commit/push/deploy in this worker.
- **Safety:** no secrets, full emails, user IDs, or customer PII recorded; no network, SQL, production write, stage, commit, push, or deploy performed.
- **Recorded by:** WORKER-LUNA-KEY-COMPAT
## 2026-08-27T12:01:57Z — Key compatibility patch verified in candidate: service-role key now wins when nonblank; secret key is trimmed fallback only when service-role key is blank/missing; no secret values were read or recorded.

- **Phase:** implementation
- **Completed/current state:** Key compatibility patch verified in candidate: service-role key now wins when nonblank; secret key is trimmed fallback only when service-role key is blank/missing; no secret values were read or recorded.
- **Next:** Integration Lead reviews the two-file diff, runs independent security review, then stages/commits/pushes and performs Preview/production gates.
- **Decision:** Owner-approved exact compatibility policy: prefer SUPABASE_SERVICE_ROLE_KEY; fallback to SUPABASE_SECRET_KEY only when legacy key is empty or missing; fail closed when both absent.
- **Evidence:**
  - Candidate /private/tmp/repairdesk-store-signup-repair-7b47c0af/src/server/supabase.ts and src/server/supabase.test.ts; focused Vitest 4/4 passed.
  - Candidate lint passed for src/server/supabase.ts and src/server/supabase.test.ts; npm run typecheck passed; git diff --check passed.
- **Recorded by:** luna_worker

## 2026-08-27T12:29:49Z — Post-deploy immediate verification; 15/30/60 observation remains pending

- **Phase:** post-deploy-immediate
- **Completed/current state:** Verified commit `e17434e8388959e14e8ed1de8323172e28c2c876`, parent `626d3df4245d100662fea776f5550412ef5c7953`, tree `6a031516a72823c0673be23a743321429756b767`; the commit contains only three files. GitHub `main` and the candidate ref both resolve exactly to this commit. Preview `dpl_9Cx9MhoXiH1F6gMyqCNRnDLyUvr8` is READY; its build passed, and a cold unauthenticated probe returned `401` rather than `500` with zero error-log hits. Production `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY and `chinatech.in` points to it. Computer Use refresh showed the ChinaTech account-opened/owner state; screenshot is `/private/tmp/repairdesk-store-signup-production-final.png`.
- **Release evidence:** Production metadata confirms both server-key variable names exist; key values were not read or printed. Recent Vercel observations were 2xx=2, 401/403/5xx=0, with relevant errors/leakage=0. Recent Supabase 20-minute observations were 12/12 2xx, auth=5, and store/profile/membership reads=1; 401/403/5xx and `Invalid API key` were 0.
- **Safety/current boundary:** No real create POST was executed and no store was created. Stable rollback `dpl_48HThuaNdK7QbhSma3REppSG4LwC` remains READY. Security review is PASS; Release/Production is conditional GO. This checkpoint does not claim task completion.
- **Next:** Continue authenticated read-only monitoring at 15, 30, and 60 minutes, retaining the reviewed Vercel rollback path and stopping on any runbook trigger; do not issue a create-store POST or mark the task complete before those observations.
- **Recorded by:** WORKER-LUNA-KEY-COMPAT

## 2026-08-27 — Final 60-minute release closeout; task closed

- **Phase:** post-deploy-observation-closeout
- **Completed/current state:** Production deployment `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY at runtime commit `e17434e8388959e14e8ed1de8323172e28c2c876`. Computer Use hard refresh showed ChinaTech / `账号已开通` / `owner`; redacted screenshot is `/Users/kyox215/.codex/visualizations/2026/08/25/01a03ac9-d6dd-7a63-b1fb-ce1c291ac896/repairdesk-store-signup-60m-2026-08-27.png`.
- **Evidence:** Vercel recent approximately two-hour target `401`/`403`/`5xx`/timeout/`Invalid API key`/`STORE_CREATE` counts were all `0`. Since READY at `2026-08-27T12:23:34.626Z`, Supabase recorded API `34`, Auth `14`, Postgres `2`, with all target categories `0`. Postcheck `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153` is 320-line pure read-only and execution `PASS` (`isError=false`); ledger/RPC/ACL/18-trigger/6-event/synthetic-residue/advisory-lock assertions passed.
- **Decision:** independent QA `PASS`; Release `GO` for docs-only closeout only. Task status is closed. This is not a real create-store POST, new account/store, or real multi-account E2E claim; `PITR=false` remains an open recovery risk.
- **Rollback/next:** retain forward-only database rollback and reviewed Vercel rollback paths. Any implementation, credential rotation, staging E2E, or production recovery requires a new Owner-approved task; no further action is authorized by this checkpoint.
## 2026-08-27T13:57:21Z — Final 60-minute read-only release closeout is recorded; task remains closed.

- **Phase:** post-deploy-observation-closeout
- **Completed/current state:** Final 60-minute read-only release closeout is recorded; task remains closed.
- **Next:** No further action in this task; open a new Owner-approved task for implementation, credential rotation, staging E2E, or recovery.
- **Decision:** Independent QA PASS; Release GO for docs-only closeout only.
- **Evidence:**
  - E-068/P-054: deployment READY on e17434e, sanitized target error categories zero, 320-line read-only postcheck execution PASS, ledger/RPC/ACL/trigger/residue/advisory-lock assertions passed.
- **Recorded by:** luna_worker
