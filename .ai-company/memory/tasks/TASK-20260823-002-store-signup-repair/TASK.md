---
schema_version: 1
task_id: "TASK-20260823-002-store-signup-repair"
title: "修复 RepairDesk 店铺注册失败并完成安全发布"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
decision_owner: "CEO-Orchestrator / RepairDesk Integration Lead"
departments: ["API", "DATA", "DOC", "INT", "QA", "SEC", "RELEASE"]
created_at: "2026-08-23T14:03:52Z"
updated_at: "2026-08-27T13:57:21Z"
---
# Task — 修复 RepairDesk 店铺注册失败并完成安全发布

## Current objective

恢复独立店铺自助创建，同时保持 tenant isolation、service-role-only RPC、认证/已验证邮箱、输入校验、原子性、幂等、rate limit、安全错误映射和可回滚发布。生产迁移、runtime key compatibility、普通 non-force `main` push、Vercel 自动部署及最终 60 分钟只读观测已于 2026-08-27 完成并有远程证据；任务现为 `closed`。本任务没有执行真实 create-store POST、创建新账号/店铺或真实多账号 E2E，`PITR=false` 风险仍保留。

## Status, identity and authority

- This is T3/R3/L2. Owner approved D3-A Option A; v29 additionally authorizes migration-first recovery/release actions only after all gates. Production data/store creation remains excluded.
- v20 Integration Lead Context Packet is verified. Lease v8 was verified at this checkpoint for the recovery sequence, but it is not treated as continuously valid; the Integration Lead must re-verify the packet/lease before each material step. Prior lease-v4/v12 evidence is historical context, not current execution authority; v19/commit-X local evidence is recorded.
- Only this task-memory writer is writing this directory. Existing API/DATA/SEC/QA/Release work is reused; no new sub-agent is spawned for this memory-only projection.
- Shared worktree remains dirty/diverged and is not a business-code write location. Any future implementation requires a clean isolated worktree and one Luna writer.

## Security and production boundary

- Preserve SECURITY DEFINER, empty search_path, actor and verified-email checks, tenant isolation, validation, atomicity, idempotency, rate limiting, and exact ACL: revoke PUBLIC/anon/authenticated; grant only service_role.
- Do not replace layered BFF/auth/email checks with current_user inside the definer function, expose the RPC to browser roles, or edit historical migration 20260724114500.
- v29 permits only reviewed production function migration, ordinary main push and Vercel production deploy after gates; no production secret/PII, historical POST, real data/store, unreviewed SQL/config, customer communication or paid PITR/add-on. Prefer rollback-only/zero-residue canary; no data-bearing production POST.
- Do not use migration repair --status applied, --with-data, copied business rows/PII, or rewrite deployed historical migrations.
- No .env.example change is authorized. Runbook may describe env categories without values.

## Confirmed evidence state

- E-002–E-007: production failures were isolated to store creation; signup/auth reads succeeded; legacy claim gate and generic error mapping are confirmed; security classification is availability/blocker, not auth bypass.
- E-030/E-031: candidate freeze CAS v3 completed at commit 871d2ca9ef8de6af056001454d66b082a1ac7e0d/tree df6862f4f820b35a18434d7585e84f39cdd78778, exact 16 paths, clean, regenerated artifact hashes; no push/DB/secret/deploy.
- E-032/E-033: first non-production branch was deleted fail-closed after a three-migration lineage mismatch; no retained branch/cost or staging PASS.
- E-034/E-035: production and ledger count 119 versus candidate 121 timestamped files; five version-name drifts and branch/CLI observations remain object-level evidence, not an exact cause.
- E-036: DATA v12 packet b35bbc2c5c85ede7306c7043504a9cf821f8133547f2303570dc1d75c45fb3d1. Production-only 20260804225445/20260804230127 map to local-main aliases 20260804140252.../20260804225900...; repo-only 20260806222149/20260807120000/20260807120100 are not production-applied. Local main 353fb0eb has SeaTable aliases only; origin/main e427c375, deployed 7b47c0af, candidate 871d2ca9 have toolkit/lifecycle; no ref has both.
- E-037: WP-20260824-002-D3-NODE24-BUILD CAS v3, writer v12 packet d44bf90bab938b21482df0bb5349a76319f46d60d8502368ad37dff4c10b05a6; Node /private/tmp/node-v24.19.0-darwin-arm64/bin/node v24.19.0/npm10.9.0, Next16.2.11; authorized font retry PASS 18s with TypeScript and 30/30 pages. No external mutation.
- Full production-parity staging is NO-GO. Limited candidate-schema signup static is conditional only and is not parity or release evidence. Prior branch was deleted and no second paid branch/push/Vercel occurred.

## D3-A Owner Option A contract — lineage design first

Owner approval is limited to repository-only lineage reconciliation design/implementation, a new candidate freeze/review, and a later non-production D3 rerun. It does not authorize production actions.

### Stage A — read-only DATA/INT design (current stage)

Determine and record, without changing candidate/source/DB:

1. Exact authoritative migration files, versions, bodies and provenance for production-only aliases 20260804225445 and 20260804230127 and repo-only 20260806222149, 20260807120000, 20260807120100 (plus candidate 20260823141758 where relevant).
2. How to isolate the three unapplied toolkit/lifecycle migrations without deleting history, rewriting deployed historical files, breaking app/build compatibility, or claiming production parity.
3. Target Git base/ref for a new candidate, path/change budget, owner of each write, invariant/rollback/test plan, and whether another Owner decision is required.
4. Whether an official GitHub/CLI data-less branch path can be used safely; no branch, push or paid retry until the method is reviewed.

Stage-A outputs are DATA packet, lineage mapping, candidate/base recommendation, proposed allowlist, risk/compatibility notes, stop conditions, and P-030/P-031 evidence placeholders. Stage A exit requires DATA/INT review; SEC/QA/Release review the resulting plan before any implementation.

### Stage B — v14 implementation complete; freeze and review pending

The v14 writer completed the reviewed repository-only plan in an isolated worktree on exactly the 17 allowlisted paths. HEAD remains the clean baseline and the paths are dirty but unstaged/uncommitted; no push, branch, DB, secret, deploy or staging action occurred. A new v15 packet must obtain DATA/SEC/QA/Release independent review and a new candidate freeze before any D3 staging work. Real Node24, pgTAP 19/19, both credential modes, rollback/re-forward, Vercel preview, TTL/cost/cleanup and recovery evidence remain open.

## v13–v19 historical lineage pointer

E-041–E-050/P-034–P-041 cover the exact 17→18-path lineage contract, v14 implementation, v15 FAIL/NO-FREEZE, path18 approval, v16/v17 review, v18 correction, v19 local PASS/GO-TO-FREEZE and post-freeze gates. Details: EVIDENCE.md, CHECKPOINTS.md and byte-faithful archives. Local only; staging/production NO-GO.
## v19 post-freeze commit X completed / v20 gates pending (2026-08-26)

- Integration Lead staged exactly 18 paths with no unstaged paths. Narrow staged diff-check produced exactly the approved `20260804230127...:497` new blank line at EOF and exact SQL SHA `6aebb597ff202f67aa8d4421a70b7fb47de589178f01d140d8bbcfd2330486a4`; staged Node24 targeted 18/18, typecheck and focused lint passed.
- Ordinary commit X is `105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc`, tree `d3510de9a1f951dbb5e1e369da7517e22e1973ec`, parent exactly `871d2ca9ef8de6af056001454d66b082a1ac7e0d`, production merge-base exactly `7b47c0afcb2bea5f1069553555c701bc75549d46`; `871d..X` exact 18 and `7b47..X` exact 33 unique paths. Worktree/index clean; no amend/squash/merge/cherry-pick, push, DB, deploy or production action.
- Next v20: QA/Release plus Supabase/Vercel/root prechecks; D3 only if all PASS; production NO-GO.

## SEV-2 security pause checkpoint (2026-08-26)

- Incident Commander for this task pause: Integration Lead; SEC owns security disposition. Remote evidence is sanitized origin `github.com/kyox215/Chinatech-codex`; Vercel project `chinatech-codex` is Node24.x and was inspected read-only at project/deployment scope.
- A browser tool internally output a full Supabase Dashboard GitHub OAuth callback containing three bearer credential types. This memory records no credential values, callback URL, session ID, email, IP or PII; the three type names are not transcribed because they were not supplied as safe labels.
- The activity page then reached a no-fragment sign-in. No repository/file write or API call occurred and no abnormal use is known. Security classified SEV-2; D3 is paused and production remains NO-GO.
- Required recovery is Owner-controlled: revoke GitHub OAuth authorization/grant, globally terminate Supabase Dashboard sessions, audit for use, then restore a clean MFA session. Revocation, termination, audit, recovery and action time are unknown; this record does not claim any completed.
- Next: Owner confirms recovery time; no D3/credential/integration/branch/migration/production work before the gate.

## P-042 recovery verified / P-043 opened (2026-08-26)

- E-053 records the Owner-controlled recovery completed and verified: the old GitHub Supabase OAuth grant was revoked at about 11:38 CEST and GitHub confirmed authorization removal plus destruction of five old Supabase access tokens; no abnormal Supabase OAuth activity was found afterward until the deliberate re-authorization.
- Supabase account audit for the prior 24 hours showed only the approximately 01:26 login, one project-settings read, two API-key metadata reads and one network-ban query; no later member/SQL/settings/deploy or customer/store business write was visible. The organization audit page exposed no verifiable record table, so this is limited to the visible audit scope.
- Google Authenticator was added at `2026-08-26T13:31:44+02:00`. Supabase's official MFA documentation states that enabling MFA signs out other user sessions and requires MFA again: https://supabase.com/docs/guides/platform/multi-factor-authentication
- Owner deliberately re-authorized Supabase; the read-only GitHub review showed five authorized apps with exactly one Supabase entry and only read-only email-address access. A new GitHub+MFA login reached Supabase Organizations by approximately `2026-08-26T13:55:54+02:00`; the target organization showed two projects.
- P-042 is now **Satisfied/verified**. The SEV-2 pause is lifted only for v20 QA/Release, Supabase/Vercel/root prechecks and approved non-production D3; production migration/deploy/canary/real store creation remain NO-GO. Only one TOTP authenticator is currently registered; an independent backup factor is recommended by the official documentation and remains an open risk.
- This recovery stage performed no business-code, DB, migration, push, deploy, production-config or real store-create action. Lease v8 was verified at this checkpoint, but the current packet/lease must be re-verified before each material step.
- E-054/E-055/E-056: v20 read-only checks still show 119 production migrations, unapplied `20260823141758` and the old claim-gate/`STORE_CREATE_FORBIDDEN`; three additional failures occurred at `08:08:53.533Z`, `08:09:08.900Z` and `08:10:12.901Z`. Candidate artifact QA is conditional, remote candidate/ref and Vercel/PITR prechecks remain unresolved, and no write occurred.
- E-057/P-044: the v21 remote candidate-ref attempt failed closed; the exact target ref is absent, sandbox DNS blocked ordinary push, and the escalated matching push was rejected pending current Owner authorization. No remote ref/fetch/file/DB/deploy/other write occurred. P-044 permits only one ordinary push of X to the named non-production ref after current confirmation and packet/lease/remote-absence rechecks.

## E-058/P-045 — Owner main-target authorization (2026-08-26)

- Owner instruction (verbatim): `确认推送 到main`. The target changes from P-044's non-production ref to only ordinary X=`105fbf9aab4a8312f7d7a0c8a0e832e8c0f3cfcc` → `refs/heads/main`; authorization excludes force/tag/ref deletion, Supabase/DB migration, real POST/store creation, and does not imply deploy/promote.
- Main may trigger Vercel production, so this action is R4/L1/D4. Before any push, fresh remote-main, branch-protection, Vercel-trigger, DB-sequencing, rollback/backup and D3/quality/security/release preflight must pass; otherwise fail closed and do not push. P-044 is superseded for target only; E-057/P-044 history remains unchanged. No external write occurred.

## E-059–E-065/P-046–P-051 — v22–v29 migration-first release gate (2026-08-27)

- E-059: 3 RO preflights: main NOW NO-GO/CONDITIONAL; origin/main=`e427c375…`; X FF only unchanged; main..X=4 commits/162 paths (131 outside signup); dirty main=`353fb0eb` has 3 absent SeaTable commits. Main unprotected/no checks; Vercel trigger unknown; prod DB119/missing migration/RPC5; no auto-migrate; Supabase integration/backup/PITR unknown; push cannot fix/risk; no push/deploy/DB/POST.
- E-060/P-046 **Satisfied**: `确认`→`确认先推非生产候选分支`; ordinary X→non-production ref/fetch SHA-tree; no main/force/tag/ref-delete/deploy/promote/Supabase/DB/POST/store.
- E-061/P-047 **Satisfied**: v23 checks PASS; DNS/elevated retry failed because `确认` lacked same-message repo+commit+ref; ref absent/no write; production NO-GO.
- E-062/P-048 **Executed; downstream deviation**: v26 `492feaf2...58f95`/lease v18; prechecks PASS; DNS-failed ordinary then elevated push created ref; ls-remote/fetch verified exact X/tree and clean candidate; no force/tag/ref-delete/main push/manual deploy/promote/Supabase/DB/POST/store/secret.
- E-063/P-049 **Verified; pending Owner decision**: Preview `dpl_8Urvbzc6iF84wUpu5gvwKjUzBTxR` READY at X; production unchanged/not promoted. “不部署” conflict; no delete authorization/tool, retained; choose retain/delete; no further action.
- E-064/P-050 **Superseded by E-065/P-051**: prior Owner D4 choice was blocked; its main/production NO-GO and Preview/backup/PITR evidence remains.
- E-065/P-051 **Owner-authorized; gates pending**: latest Owner instruction `设置目标并修复所有问题 直到可以创建店铺 ，解决所有问题。完成后推送并部署` created an active objective; migration-first authorizes required D3, reviewed production function migration, ordinary main push and Vercel production deploy (R4/L1/D4). Prohibits force/tag/ref-delete, history rewrite/repair/with-data, irreversible deletion, secret/PII/customer communication, paid PITR/add-ons and data-bearing production POST; prefer rollback-only/zero-residue canary; stop on lineage/ACL/RLS/auth/tenant/backup/remote-SHA deviation. Status `in_progress / owner-authorized-migration-first-recovery-and-release`; production writes only after gates. Next: live baseline→D3→independent DATA/SEC/QA/Release→prod 119→120→main/Vercel→15/30/60; main/production remain gated NO-GO.

## Stop conditions and rollback

## E-068/P-054 — Final 60-minute release closeout (2026-08-27)

- Production deployment `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY and serves runtime commit `e17434e8388959e14e8ed1de8323172e28c2c876`. Computer Use hard refresh showed the ChinaTech account-opened state (`账号已开通`, `owner`); redacted screenshot: `/Users/kyox215/.codex/visualizations/2026/08/25/01a03ac9-d6dd-7a63-b1fb-ce1c291ac896/repairdesk-store-signup-60m-2026-08-27.png`.
- Vercel sanitized observations over the recent approximately two-hour window recorded target `401`/`403`/`5xx`/timeout/`Invalid API key`/`STORE_CREATE` counts all `0`. From READY at `2026-08-27T12:23:34.626Z`, Supabase observations recorded API `34`, Auth `14`, and Postgres `2`; every same target error category remained `0`.
- Independent QA review is `PASS`; Release disposition is `GO` for the docs-only closeout. Postcheck `/private/tmp/repairdesk_store_signup_postapply_postcheck_v30.sql` is 320 lines, SHA-256 `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153`, pure read-only, and returned `isError=false`.
- Postcheck assertions passed for committed ledger `120/120`, RPC definition/owner/language/SECURITY DEFINER/empty `search_path`/ACL, 18 normal-trigger and 6 managed-event-trigger closure, synthetic auth/profile/store/child/operation residue, and advisory-lock residue. Rollback-only rehearsal/canary remained zero-residue.
- Limitation: no real create-store POST, new account/store, or real multi-account E2E was executed or claimed. `PITR=false` remains a recovery-risk limitation. Future database recovery is forward-only per the runbook; retain Vercel rollback for app/runtime failures.

Stop on unknown lineage/provenance, scope mutation, production ref/host, secret/PII, branch mismatch, missing backup/PITR, ACL/RLS/auth/tenant change or historical repair/with-data. Rollback only reviewed new-timestamp forward rollback→re-forward; never edit history/delete rows/clear ledgers/replay POSTs.

## Acceptance and release gates

- Design acceptance: every five drift versions has authoritative body/provenance mapping; aliases are explicitly classified; no single ref is falsely called production parity; target base, allowlist, invariants, rollback and tests are reviewable; stop conditions and Owner decision points are explicit.
- Real create-store acceptance is intentionally unexecuted: no real PostgREST create, new account/store, or real multi-account E2E was used as a probe. The docs-only release closeout is instead evidenced by E-068/P-054, including read-only postcheck, deployment, and 15/30/60 observation results.
- The docs-only release gate passed with clean deployed lineage, backup evidence, read-only postcheck, DATA/SEC/QA/Release conclusions, and the final 60-minute observation. `PITR=false` remains an explicit recovery-risk limitation; full restore proof and real mutation/E2E acceptance are not claimed.
- Local Node22/Node24 builds and candidate freeze do not equal staging or production proof.

## Evidence and archive index

- EVIDENCE.md preserves stable E-001–E-065 and P-001–P-051; add later results without inventing completion.
- Archives: TASK_ARCHIVE_20260823_PRE_WP05E.md; TASK_ARCHIVE_20260825_PRE_V13.md; CHECKPOINTS_ARCHIVE_20260823_PRE_COMPACTION.md; EVIDENCE_ARCHIVE_20260824_PRE_V11_LINEAGE.md; MEMORY_DELTA_ARCHIVE_20260824_PRE_V12.md; HANDOFF_ARCHIVE_20260825_PRE_V13.md.
- Archive hashes are recorded in the corresponding live checkpoint/evidence notes. Live packet sources are intentionally kept below 27,500 bytes.

## Next action

Task closed after the final 60-minute read-only gate. Future fixes, credential rotation, staging E2E, or recovery must be opened as a new scoped task with Owner approval and fresh DATA/SEC/QA/Release gates; no real store mutation is implied.

This memory projection records the completed migration/runtime/release evidence and read-only observation, but it does not claim a real create-store POST, new account/store, or real multi-account E2E.
## 2026-08-27T11:51:52Z — Runtime key-compatibility recovery checkpoint

- Owner explicitly authorized the sensitive compatibility decision after seeing the exact risk text and replying `继续`: when both server-only Supabase key variables are present, use the verified working legacy `SUPABASE_SERVICE_ROLE_KEY`; use `SUPABASE_SECRET_KEY` only when the legacy variable is missing or blank; fail closed when both are absent. The authorization includes the corresponding code/tests change, ordinary non-force push to `main`, and redeployment.
- Candidate HEAD is `626d3df4245d100662fea776f5550412ef5c7953`; candidate worktree was clean at checkpoint time. No code change has yet been applied or tested in this recovery step.
- Production evidence: hotfix deployment `dpl_2XB...` selected the secret key and returned `401 Invalid API key` on the same account path; it was rolled back. The formal domain currently points to READY stable deployment `dpl_48H...`; the same account path returned 200 throughout at `2026-08-27T11:34:00Z`, and Computer Use showed the account-opened state.
- The database migration/canary remains healthy and is not rolled back. Next implementation scope is limited to `src/server/supabase.ts` and `src/server/supabase.test.ts`, followed by focused tests, lint, typecheck, diff-check, then the separately gated main push and redeploy.
- This checkpoint records authorization and evidence only; it is not a claim that the compatibility patch, tests, push, redeploy, migration, or store creation is complete. No key value, full email, user ID, or customer PII is recorded.

## Final status projection (2026-08-27)

- E-068/P-054 is the latest state and supersedes the earlier pending language in historical checkpoints: status is `closed`; production deployment `dpl_8Vk8CvGq4Bzj3ziaYkqFXk3Ki9QM` is READY on runtime commit `e17434e8388959e14e8ed1de8323172e28c2c876`.
- The redacted ChinaTech / `账号已开通` / `owner` screenshot is `/Users/kyox215/.codex/visualizations/2026/08/25/01a03ac9-d6dd-7a63-b1fb-ce1c291ac896/repairdesk-store-signup-60m-2026-08-27.png`; Vercel and post-READY Supabase target error categories are all `0`.
- The 320-line pure read-only postcheck SHA `f0fd3415ad343100524148e42e588b656efd1b168541689100f24c9314df7153` executed `PASS`; ledger/RPC/ACL/18-trigger/6-event/residue/advisory-lock assertions passed. Independent QA is `PASS`; Release is `GO` for docs-only closeout only.
- No real create-store POST, new account/store, or real multi-account E2E was executed or claimed. `PITR=false` remains a recovery risk; future DB recovery is forward-only and any new implementation/recovery/E2E needs a new Owner-approved task.
