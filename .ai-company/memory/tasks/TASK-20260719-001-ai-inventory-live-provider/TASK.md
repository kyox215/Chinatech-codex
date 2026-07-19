---
schema_version: 1
task_id: "TASK-20260719-001-ai-inventory-live-provider"
title: "Chinatech 库存入库 AI 图片标签识别真实接入"
status: "conditional"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["API", "DATA", "INT", "QA", "Release", "SEC", "UI"]
created_at: "2026-07-19T00:16:17Z"
updated_at: "2026-07-19T13:44:42Z"
---

# Task — Chinatech 库存入库 AI 图片标签识别真实接入

## Owner request

完成 Chinatech Vision 客户端卡死修复、全链路验证、推送 main、休眠部署与唯一一次单店灰度。

## Business value

以单店、硬预算、隐私最小化方式把库存标签照片转换为人工确认的入库候选，保留手工流程和零自动写入。

## Scope in

- Reconcile the earlier Vision candidate against current `origin/main`; never publish the stale candidate directly and never race the serialized order-text production release.
- Add a server-side full image decode/re-encode trust boundary before any external call.
- Keep the existing native-fetch OpenAI Responses provider, exact snapshot model, `store:false`, strict structured output, single dispatch, hard timeout and usage capture.
- Require a stable client request UUID and bind the durable budget fingerprint to the server-sanitized image and exact model.
- Enforce capability, Chinatech-only rollout, independent image-egress approval, exact DB/environment policy attestation, reservation-before-dispatch and conservative settlement.
- Preserve local OCR and browser-native barcode recognition, human review, unsaved draft application and the dedicated scan/manual identifier path on mobile and desktop.
- Address architecture/security review findings: pre-body capability/rate gate, non-retryable provider configuration errors, compiled pilot ceilings and mutually distinct secrets.
- Validate with focused/full tests, production build, runtime dependency audit, secret/client-bundle scan, mocked cloud-fallback E2E and visual evidence.
- Remediate the mobile client stall without adding dependencies: bound or remove non-preemptible main-thread barcode work from this optional Vision path, bound Blob-to-data-URL conversion, add a whole-pipeline watchdog and show distinct preparation/local/cloud stages.
- Preserve a one-tap manual Next path and an actionable timeout/error state; a stale completion must never overwrite a newer upload or cleared image.

## Scope out

- Automatic inventory writes, price/cost/source inference, customer/public AI, PII uploads, arbitrary tools, provider-side storage or multi-store rollout.
- Cloud extraction of IMEI/SN/barcodes; these remain local scan/manual evidence in the initial privacy boundary.
- Automatic inventory writes, real customer/identifier images, public/customer AI, other stores, retries, a second paid Vision smoke, or model/budget changes outside the approved Vision D4.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 发布候选具备服务端图片完整解码、去元数据与尺寸限制，只有净化衍生图可进入 OpenAI。
- [x] Vision provider 使用固定模型、`store:false`、严格结构、单次尝试、硬超时和稳定请求 ID。
- [x] 每次付费调用前经过 Chinatech allowlist、权限、图片外发批准、精确 DB/env policy attestation 与 durable 预算预留。
- [x] 识别结果仅形成需人工确认的未保存草稿，错误、离线或 AI 关闭时手工入库保持可用。
- [x] 完成全量测试、安全检查、移动/桌面 mocked-cloud E2E 与截图。
- [x] Owner 明确批准复用 `$50/月` v2 合并硬预算、图片数据边界、一次合成图片计费 smoke 与正式域名测试账号验收。
- [x] 手机端客户端链路不会因同步本地条码回退或无界 FileReader 永久卡住；每个阶段有明确反馈，超时可恢复并保留手工下一步。
- [x] 本地识别不可用或超时时只发出一次服务端 Vision 请求，旧请求不能覆盖新选择，且整个流程仍不自动写库存。
- [x] 完成 focused/full tests、lint、typecheck、build、安全检查及 390/1280 浏览器证据。
- [x] 推送最新修复到 `main`，保持 Vision 关闭部署；生产预检通过后才开放唯一一次无 PII smoke，完成 ChinaTech 单店手机/电脑验收与观察。

## Facts, assumptions, and unknowns

| Item                                                                                                                            | Type                   | Evidence                                                                        | Status / next action                                   |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Current main-line provider already supports OpenAI Responses for order text and specification-only Vision                       | observed               | `openai-responses-provider.ts`; `vision-assistant.service.ts`                   | harden rather than replace                             |
| Existing Production key/secrets and live-provider migrations exist; order-text D4-v2 is approved but explicitly excludes Vision | verified remote record | `origin/main@152caa1c`; `TASK-20260718-014-ai-assistant-live-pilot`             | do not infer photo-egress approval                     |
| The order-text release completed its 30-minute observation and released the serialized Production write lock                    | verified               | closeout `a3ae676d`; order task E-034..E-037                                    | include closeout before Vision release                 |
| Earlier Vision candidate contains useful Sharp/tests but required independent API/QA/security hardening                         | verified               | QA/API/SEC post-diff reviews; stale worktree diff                               | only reviewed increments were ported                   |
| UI already creates human-confirmed unsaved drafts and locally recognizes identifiers                                            | observed               | inventory intake components and E2E                                             | preserve zero-write invariant                          |
| Exact Vision photo-egress terms and formal-domain test-account use are approved for ChinaTech                                   | verified Owner D4      | Owner message; E-016                                                            | execute only the frozen scope                          |
| Local release candidate is reconciled onto the order-text canary closeout and passes release gates                              | verified               | branch `codex/ai-inventory-vision-integration-20260719`; base `a3ae676d`; E-019 | push exact reviewed lineage                            |
| Exact locked server decoder is `sharp@0.34.5`                                                                                   | verified               | clean `npm ci`; runtime version; lockfile                                       | production dependency audit returned 0 vulnerabilities |
| Mocked cloud fallback preserves zero-write behavior on desktop and mobile                                                       | verified               | 6 Playwright tests; task evidence screenshots                                   | no real provider or inventory create request           |
| Prepared-state render aborted the current controller and left V2 status working forever                                         | reproduced             | `inventory-v2-vision-draft.test.tsx`; pre-fix failure and post-fix pass         | exact incident root cause locked                       |
| Remediated V2 flow preserves manual Next and zero-write behavior at 390px/1280px                                                | verified local         | 3 V2 Playwright tests; `vision-v2-*.png`                                        | mocked provider only; no real Vision call              |
| Production one-shot returned the five expected synthetic specification fields with one settled provider attempt                 | verified production    | E-037; linked ledger/audit aggregate; production mobile screenshot              | 30-minute observation passed; 24-hour review pending   |
| Production human apply leaves identifiers blank and does not create inventory                                                   | verified production    | E-038; before/after count `4`; production DOM/screenshots                       | preserve as release invariant                          |

## Decision and approval points

- **D1 / approved:** isolated implementation, mocked provider/RPC tests, fake browser flows, documentation and release preparation.
- **D4 / approved 2026-07-19:** reuse immutable `ai-runtime-v2`: `$50/month`, order `20/day`, Vision `10/day`, global `300/day`, actor `30/minute`; cropped packaging-label data only; one synthetic no-PII Vision smoke; `main` push/deploy; ChinaTech-only Vision activation; authenticated phone/desktop verification.
- **Boundary:** order-text traffic remains active; deploy Vision dormant first. Only the one approved synthetic Vision request may be billable before the triple gate passes.
- **Frozen exclusions:** people, IDs, customer data, receipts/addresses, device screens, IMEI/SN/EAN, automatic writes, public AI, other stores, retries, and any model/budget expansion.

## Work packages

1. Restore the incident record and reconcile onto latest `origin/main` in a clean isolated worktree.
2. Reproduce or lock the client hang with executable tests and stage-level observability.
3. Implement the smallest main-thread-safe local-recognition fallback, bounded Blob conversion, whole-pipeline watchdog and stage-specific UI.
4. Run focused tests, full lint/typecheck/test/build, dependency/security scans and no-auto-write checks.
5. Verify mobile and desktop loading/error/manual/cloud-review states with screenshots and overflow assertions.
6. Complete independent architecture, QA/UX and security/release reviews; resolve every blocker/major finding.
7. Sync the incident, runbook, task memory and final evidence; recheck remote drift and push the scoped commit to `main`.
8. Deploy latest main with Vision disabled, run production policy/ledger/runtime preflight, then open only the approved ChinaTech test gate for one no-PII smoke, verify audit/cost/result and observe or roll back flags-first.

## Agent plan

- Integration Lead: `integration_write`; sole writer, final integration, commit, push, deploy and production verification.
- Architecture / frontend reliability reviewer: real read-only sub-agent; inspect the client call chain and compare minimal remediation options.
- QA / UX reviewer: real read-only sub-agent; define reproducible regression coverage, mobile/desktop states and screenshot matrix.
- Security / privacy / release reviewer: real read-only sub-agent; verify no identifier egress, budget/tenant gates, release sequencing and rollback thresholds.
- Sub-agents may not edit, stage, commit, push, deploy, access secrets or mutate production data.

## Agent execution record

| Canonical task                         | Department / role                   | Mode                     | Final result                                                                                               |
| -------------------------------------- | ----------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `/root`                                | Integration Lead                    | sole `integration_write` | implementation, integration and release owner                                                              |
| `/root/vision_arch_review`             | Architecture / frontend reliability | read-only                | PASS; option A implemented, no architecture blocker                                                        |
| `/root/vision_qa_ux_review`            | QA / UX                             | read-only                | PASS for final local candidate; mobile/desktop and manual fallback verified                                |
| `/root/vision_security_release_review` | Security / privacy / release        | read-only                | PASS; dormant deploy, zero baseline, exactly-once smoke and 30-minute observation conditions are satisfied |

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
