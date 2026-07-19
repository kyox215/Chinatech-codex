# Checkpoints — TASK-20260719-001-ai-inventory-live-provider

## 2026-07-19T00:16:17Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.

## 2026-07-19T00:51:31Z — Local Vision release candidate verified; awaiting Owner D4

- **Phase:** release preparation / owner approval gate.
- **Completed:** ported the reviewed Vision increments onto `ai-runtime-v2`; added server full decode/re-encode and metadata stripping, stable client UUID, model-bound sanitized-image fingerprint, Chinatech-only egress, compiled ceilings/distinct secrets, pre-body capability/rate gate, safe provider error mapping and defensive identifier validation. Added mocked cloud desktop/mobile E2E, privacy copy, screenshots and a dedicated production runbook.
- **Evidence:** lint/typecheck/agents pass; 305 files / 1910 tests pass; Next Turbopack build passes; Playwright 6/6 passes; `sharp@0.34.5`; npm production audit 0 vulnerabilities; scoped secret scans and `git diff --check` pass.
- **Decisions:** initial cloud remains specification-only (`identifiers=[]`); AI produces only a human-confirmed unsaved draft; production recommendation is `$3/month`, 20 order + 10 Vision requests per day for Chinatech, global 30/day and actor 10/minute.
- **Risks/blockers:** exact budget and cropped-photo privacy boundary are not approved. Therefore no v2 policy insert, production env mutation, paid smoke, `main` push, deploy or canary activation occurred.
- **Next:** obtain explicit Owner D4 using the exact packet in `docs/AI_ASSISTANT_VISION_PILOT_RUNBOOK.md`; then recheck drift and execute the documented disabled-policy → dormant deploy → two synthetic smoke → Chinatech activation → 30-minute/24-hour observation sequence.

## 2026-07-19T00:53:05Z — Vision 本地发布候选已完成：服务端 Sharp 净化、真实 OpenAI provider、Chinatech 单店外发/预算门禁、稳定请求 ID、标识符防御、pre-body 限流、隐私文案与 mocked-cloud E2E 已实施；lint/typecheck/agents、305 文件 1910 测试、Turbopack build、Playwright 6/6、npm audit 0 均通过。生产未修改。

- **Phase:** conditional-release-closeout
- **Completed/current state:** Vision 本地发布候选已完成：服务端 Sharp 净化、真实 OpenAI provider、Chinatech 单店外发/预算门禁、稳定请求 ID、标识符防御、pre-body 限流、隐私文案与 mocked-cloud E2E 已实施；lint/typecheck/agents、305 文件 1910 测试、Turbopack build、Playwright 6/6、npm audit 0 均通过。生产未修改。
- **Next:** superseded by the 2026-07-19T01:01:26Z checkpoint below after remote release drift was discovered.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator

## 2026-07-19T01:01:26Z — Reconciled Vision gate with approved immutable v2 policy

- **Phase:** latest-main reconciliation / independent Vision approval gate.
- **Completed/current state:** fetched remote state and found `origin/main@ec134a42` records order-text D4-v2 while explicitly excluding Vision. The concurrent order release checkpoint reports its one authorized order-text smoke succeeded; this Vision task still has zero real Vision calls and zero Production writes. Updated the Vision packet to reuse the existing v2 `$50/month`, `20 order/day`, `10 Vision/day`, `300 global/day`, `30 actor/minute` policy values instead of proposing a conflicting `$3` policy.
- **Decisions:** do not create or mutate a second v2 policy; request exactly one additional synthetic no-PII Vision smoke; require explicit permission for test-account mobile/desktop acceptance on `www.chinatech.in`; preserve the order-text release's active context and serialized Production write lock.
- **Risks/blockers:** cropped-photo egress and Vision activation remain unapproved. The order-text release lock must be released before this task changes Supabase, Vercel, `main`, or the formal domain.
- **Next:** finish the conflict-free source rebase onto `origin/main@ec134a42`, rerun local release gates, then obtain the exact independent Vision D4 from the Owner before any paid Vision request, push, deploy, env write or activation.
- **Evidence:** E-014 and `docs/AI_ASSISTANT_VISION_PILOT_RUNBOOK.md`.

## 2026-07-19T01:08:03Z — Vision 候选已重放到 origin/main@152caa1c；agents/lint/typecheck、305 文件 1910 测试与 26 页生产构建通过；图片链路仍零真实调用、零生产写入。批准包改为复用既有 ai-runtime-v2 的 50 美元/月与 20/10/300/30 限额。

- **Phase:** owner-approval-gate
- **Completed/current state:** Vision 候选已重放到 origin/main@152caa1c；agents/lint/typecheck、305 文件 1910 测试与 26 页生产构建通过；图片链路仍零真实调用、零生产写入。批准包改为复用既有 ai-runtime-v2 的 50 美元/月与 20/10/300/30 限额。
- **Next:** 等待 TASK-20260718-014 释放生产写锁并取得 Owner 独立 Vision D4；随后刷新 drift、证明既有 v2 policy、推送 main、Vision 休眠部署、执行一次合成无 PII Vision smoke、Chinatech 手机/桌面验收与 30 分钟观察。
- **Decision:** Reuse immutable ai-runtime-v2 50 USD monthly hard cap and 20 order/day, 10 vision/day, 300 global/day, 30 actor/minute; one additional synthetic Vision smoke only.
- **Blocker:** Independent Vision photo-egress D4 is not approved; serialized order-text production release lock remains active.
- **Evidence:**
  - E-015: base 152caa1c; agents/lint/typecheck pass; Vitest 305/1910; Next build 26 pages; no Vision production call.
- **Recorded by:** CEO-Orchestrator

## 2026-07-19T05:47:33Z — Vision D4 approved; production preflight passed

- **Phase:** approved / serialized production release.
- **Owner authority:** ChinaTech only; reuse immutable `ai-runtime-v2` `$50/month` shared hard cap and its existing 20 order/day, 10 Vision/day, 300 global/day and 30 actor/minute limits; cropped packaging labels only; exactly one synthetic no-PII Vision smoke; authenticated phone/desktop verification on `www.chinatech.in`.
- **Frozen exclusions:** people, IDs, customer data, receipts/addresses, device screens, IMEI/SN/EAN, automatic inventory writes, public/customer AI, other stores, retries and any model/budget expansion.
- **Release lock:** order-text canary completed a clean 30-minute observation in closeout `a3ae676d`; the Vision candidate is rebased onto that record under one writer.
- **Preflight:** Production is READY on `main@152caa1c`; `ai-runtime-v2` is enabled with 5 settled order requests and zero open/bad/Vision/cross-store requests; Vision audit count is zero; four AI tables have RLS and no anon/authenticated table privileges; scoped Vercel runtime errors are zero.
- **Next:** commit approval evidence, push exact lineage to `main`, deploy with Vision flags off, attest v2 and execute the single approved Vision smoke.

## 2026-07-19T05:49:36Z — Owner 已批准 ChinaTech Vision D4；订单文字 canary 已完成 30 分钟观察并释放写锁；Vision 候选已重放到 a3ae676d。生产预检：v2 enabled、5 次文字请求、open/bad/Vision/跨店均为 0、Vision audit 为 0、AI 表 4/4 RLS 且客户端无表权限、Vercel runtime errors 为 0。

- **Phase:** production-release
- **Completed/current state:** Owner 已批准 ChinaTech Vision D4；订单文字 canary 已完成 30 分钟观察并释放写锁；Vision 候选已重放到 a3ae676d。生产预检：v2 enabled、5 次文字请求、open/bad/Vision/跨店均为 0、Vision audit 为 0、AI 表 4/4 RLS 且客户端无表权限、Vercel runtime errors 为 0。
- **Next:** 提交批准证据，推送 exact lineage 到 main；保持 Vision flags off 部署；证明 v2 policy 后执行唯一一次合成无 PII Vision smoke。
- **Decision:** Only ChinaTech cropped packaging labels; reuse ai-runtime-v2 50 USD hard cap and 20/10/300/30 quotas; one synthetic Vision smoke; formal-domain phone/desktop verification.
- **Evidence:**
  - E-016 Owner D4; E-017 order release lock closed; E-018 live Supabase/Vercel preflight.
- **Recorded by:** CEO-Orchestrator

## 2026-07-19T05:58:55Z — Exact post-closeout release candidate gates passed

- **Phase:** production-release.
- **Candidate:** branch `codex/ai-inventory-vision-integration-20260719` is based on order canary closeout `a3ae676d` and contains the reviewed Vision implementation plus approval evidence.
- **Gates:** agents/lint/typecheck passed; Vitest 305 files / 1910 tests passed; Next 16.2.6 production build generated 26 static pages; isolated desktop/mobile mocked-cloud Playwright passed 6/6 with zero inventory-create requests; exact `sharp@0.34.5`; production npm audit returned 0 vulnerabilities; refined key and generated-client-bundle scans returned no matches; `git diff --check` passed.
- **Test configuration note:** the valid browser gate explicitly enabled the local fake-provider Vision capability flags; the earlier flags-off local run was not treated as product evidence.
- **Next:** commit the exact evidence, recheck remote drift, then push the reviewed fast-forward lineage to `main` and deploy dormant.
- **Evidence:** E-019.

## 2026-07-19T08:01:48Z — Vision test entrance enabled; awaiting one manual upload

- **Phase:** production-release / manual smoke handoff.
- **Completed/current state:** only the approved ChinaTech Vision gates were enabled; the authenticated desktop and 390x844 mobile entry were visible; Vision usage/open/audit remained `0/0/0`.
- **Next:** one manual cropped no-PII label upload; no retry.
- **Evidence:** E-021.

## 2026-07-19T11:12:25Z — Mobile Vision client stall contained

- **Phase:** incident response / contained.
- **Completed/current state:** the mobile flow stalled after safe-image preparation and before HTTP. Supabase usage/open/audit remained `0/0/0`; Vercel had no Vision route request; all three Vision gates were disabled.
- **Decision:** flags-first rollback; preserve manual intake; no second upload.
- **Risks:** synchronous ZXing is the leading but not yet reproduced cause; unbounded FileReader remains a secondary candidate.
- **Evidence:** E-022 and `INCIDENT-20260719-VISION-CLIENT-STALL.md`.

## 2026-07-19T11:40:21Z — Owner resumed full remediation and release

- **Phase:** client-stall remediation / planned.
- **Owner authority:** plan, implement, validate, push `main`, deploy and complete the already approved ChinaTech-only exactly-once no-PII smoke.
- **Baseline:** clean isolated branch `codex/vision-client-stall-hotfix-20260719` at `origin/main@041a4e0f`; root dirty worktree remains untouched.
- **Plan:** `REMEDIATION_PLAN.md`; one Integration Lead writer plus three independent read-only architecture, QA/UX and security/release reviews.
- **Stop condition:** Vision remains off until remediation and every preflight gate pass.
- **Next:** lock the client failure with tests, integrate the smallest safe fix and complete review/verification.

## 2026-07-19T12:10:10Z — Client self-abort root cause fixed; V2 browser evidence passed

- **Phase:** client-stall remediation / verification.
- **Confirmed root cause:** the V2 card cleanup effect depended on `prepared`; the prepared-state render aborted the current controller and the handler returned while status remained working. A regression test failed before the fix and passes after ref-based disposal plus unmount/explicit-reset cleanup.
- **Completed:** both production Vision callers now have bounded FileReader conversion and a 75-second whole-pipeline watchdog; the optional photo path no longer invokes main-thread ZXing; preparation/local/cloud stages are explicit and accessible; stale runs cannot overwrite a newer image; manual Next and zero automatic inventory writes remain intact.
- **Evidence:** focused Vitest 5 files / 43 tests passed; V2 Playwright 3/3 passed at 390x844 and 1280x800 with mocked cloud, exactly one request per flow, zero create requests and five inspected `vision-v2-*.png` screenshots.
- **Decision:** production Vision stays off. The single formal smoke must use a pre-inspected synthetic specifications-only image because re-encoding and schema controls cannot prove selected pixels contain no prohibited text.
- **Next:** finish runbook/task synchronization, full repository gates and final independent security/release review; then recheck remote drift before any push.

## 2026-07-19T12:19:51Z — Final local quality, browser and security gates passed

- **Phase:** release-candidate verification.
- **Completed:** final candidate passes agents/lint/typecheck; repository Vitest passes 309 files / 1978 tests; Next 16.2.6 production build succeeds with 26 static pages; production npm audit reports 0 vulnerabilities; Sharp resolves exactly to 0.34.5; refined changed-source key scan and generated client bundle secret-name scan return no matches; `git diff --check` passes.
- **Browser evidence:** legacy inventory Vision passes 6/6 with V2 flags off; `/inventory/new` V2 passes 3/3 with V2 flags on. These configurations are mutually exclusive by product design, so they were validated separately. All flows use synthetic images and mocked cloud, make at most one Vision request and record zero inventory-create requests.
- **Documentation:** runbook now requires dormant deploy/off, zero baseline, Chinatech-only triple-gate activation, one pre-inspected synthetic UI smoke, exact ledger/audit `+1`, no retry for `sent_unknown`, 75-second/manual-Next stop thresholds and a single-test-operator 30-minute window.
- **Next:** collect final independent architecture, QA/UX and security/release verdicts; then run scoped diff review, memory checkpoint and fresh remote-drift check before commit/push.

## 2026-07-19T12:26:26Z — 客户端 effect 自取消根因已修复；方案 A 已落地。focused 5/43、全仓 309/1978、lint/typecheck/agents、26 页构建、audit 0、旧入口 6/6、V2 3/3 与三项独立复核通过。生产 Vision 保持关闭，唯一 smoke 未消耗。

- **Phase:** release-candidate-verified
- **Completed/current state:** 客户端 effect 自取消根因已修复；方案 A 已落地。focused 5/43、全仓 309/1978、lint/typecheck/agents、26 页构建、audit 0、旧入口 6/6、V2 3/3 与三项独立复核通过。生产 Vision 保持关闭，唯一 smoke 未消耗。
- **Next:** 提交 scoped candidate，重新 fetch 并 fast-forward 推送 main；把三项 Vision 变量明确设为 0 后休眠部署，验证 exact SHA 与零账本，再按 runbook 执行唯一一次事先目检的合成规格图 smoke。
- **Decision:** 采用 ref/run-id、native-only optional detector、8 秒 FileReader 与 75 秒全链路 watchdog；发布按 off deploy -> zero baseline -> ChinaTech triple gate -> one UI smoke -> exact +1/no retry。
- **Blocker:** Production release remains conditional on dormant deployment, zero-ledger preflight and exactly-once smoke; any mismatch triggers flags-first rollback.
- **Evidence:**
  - E-024..E-033
- **Recorded by:** Integration-Lead

## 2026-07-19T13:15:29Z — Production Vision one-shot passed; 30-minute observation active

- **Release identity:** hotfix commit `50f843ddb2f5f734708c70144d8860e19d857dbc` is on `main`; dormant deployment `dpl_AXAgvZ9y1XRpgXouwwuYno23TcwD` passed off-state checks; enabled deployment `dpl_Gfqrd7rT2U8vo79qe7DRdD3P4eKm` is READY on `www.chinatech.in` and `chinatech.in`.
- **Preflight:** exact `ai-runtime-v2` policy; zero Vision usage/open/audit/attempts; ChinaTech inventory baseline `4`; four AI tables have RLS and zero browser-role grants; exact-main linked migration dry-run reports remote up to date; errors-only runtime event count is zero.
- **Production UI:** authenticated ChinaTech desktop and 390x844 mobile disabled-state checks passed; manual Next reached step 3. After activation the mobile formal UI sent the single pre-inspected synthetic no-PII label and returned exactly `NOVA / A7 PRO / BLUE / 8 GB / 256 GB`.
- **Durable result:** Vision ledger/audit each increased exactly once; request succeeded and settled from usage, provider attempt count is `1`, cost is `5713` micro-USD, no open/non-success/cross-store request exists, and the privacy-safe audit has no error. `has_safety_identifier=true` records the expected anonymous OpenAI abuse-safety identifier control, not a device/customer identifier.
- **Zero write:** applying selected candidates changed only the browser draft; the identifier input stayed blank and ChinaTech inventory count remained `4`.
- **Observation:** database reservation time `2026-07-19T13:11:21.021029Z`; keep the single-operator/no-more-upload window through at least `2026-07-19T13:41:21.021029Z`. Do not close early.
- **Evidence:** E-034..E-038 and production screenshots in the task evidence directory.

## 2026-07-19T13:42:19Z — 30-minute ChinaTech Vision observation passed

- **Phase:** conditional release closeout.
- **Window:** durable reservation began at `2026-07-19T13:11:21.021029Z`; the final linked aggregate was taken at `2026-07-19T13:42:19.925504Z`, after the full approved window.
- **Durable result:** Vision request/attempt/audit remained `1/1/1`; open, non-success, cross-store and audit-non-success counts remained `0`; settled cost remained `5713` micro-USD; ChinaTech inventory remained `4`.
- **Runtime/deploy:** explicit-project Vercel errors-only query completed with zero events; `www.chinatech.in` remained READY on deployment `dpl_Axoxjvdccawd5dDSPhShGiJs1xgR`.
- **Decision:** no rollback condition fired. Keep ChinaTech-only Vision and human draft apply enabled within the frozen data boundary. No second provider smoke is permitted.
- **Residual gate:** at or after `2026-07-20T13:11:21.021029Z`, run one read-only 24-hour policy/ledger/audit/runtime review; this is why closure remains conditional.
- **Evidence:** E-039; production screenshots and synthetic label in the task evidence directory.

## 2026-07-19T13:44:42Z — Chinatech Vision hotfix is on main; one synthetic no-PII production smoke returned five expected fields; request/attempt/audit stayed 1/1/1; 5713 micro-USD settled; inventory stayed 4; 30-minute observation passed with zero open, bad, cross-store or Vercel error events; release conditionally closed.

- **Phase:** implementation
- **Completed/current state:** Chinatech Vision hotfix is on main; one synthetic no-PII production smoke returned five expected fields; request/attempt/audit stayed 1/1/1; 5713 micro-USD settled; inventory stayed 4; 30-minute observation passed with zero open, bad, cross-store or Vercel error events; release conditionally closed.
- **Next:** At or after 2026-07-20T13:11:21.021029Z, perform the read-only 24-hour policy/ledger/audit/runtime review; do not run a second provider smoke.
- **Evidence:** none added by this command; do not infer validation.
- **Recorded by:** CEO-Orchestrator
