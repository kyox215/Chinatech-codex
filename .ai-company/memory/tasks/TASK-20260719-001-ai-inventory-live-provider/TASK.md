---
schema_version: 1
task_id: "TASK-20260719-001-ai-inventory-live-provider"
title: "Chinatech 库存入库 AI 图片标签识别真实接入"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["API", "DATA", "INT", "QA", "Release", "SEC", "UI"]
created_at: "2026-07-19T00:16:17Z"
updated_at: "2026-07-19T05:58:55Z"
---

# Task — Chinatech 库存入库 AI 图片标签识别真实接入

## Owner request

Chinatech 库存入库 AI 图片标签识别真实接入

## Business value

以单店、硬预算、隐私最小化方式把库存标签照片转换为人工确认的入库候选，保留手工流程和零自动写入。

## Scope in

- Reconcile the earlier Vision candidate against current `origin/main`; never publish the stale candidate directly and never race the serialized order-text production release.
- Add a server-side full image decode/re-encode trust boundary before any external call.
- Keep the existing native-fetch OpenAI Responses provider, exact snapshot model, `store:false`, strict structured output, single dispatch, hard timeout and usage capture.
- Require a stable client request UUID and bind the durable budget fingerprint to the server-sanitized image and exact model.
- Enforce capability, Chinatech-only rollout, independent image-egress approval, exact DB/environment policy attestation, reservation-before-dispatch and conservative settlement.
- Preserve local OCR/barcode recognition, human review, unsaved draft application and manual/offline fallback on mobile and desktop.
- Address architecture/security review findings: pre-body capability/rate gate, non-retryable provider configuration errors, compiled pilot ceilings and mutually distinct secrets.
- Validate with focused/full tests, production build, runtime dependency audit, secret/client-bundle scan, mocked cloud-fallback E2E and visual evidence.

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
- [ ] 订单文字发布锁释放且 Vision D4 获批后，复核/证明既有 v2 policy，推送 `main`、Vision 休眠部署、完成一次 Vision smoke、Chinatech 单店灰度与观察。

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

## Decision and approval points

- **D1 / approved:** isolated implementation, mocked provider/RPC tests, fake browser flows, documentation and release preparation.
- **D4 / approved 2026-07-19:** reuse immutable `ai-runtime-v2`: `$50/month`, order `20/day`, Vision `10/day`, global `300/day`, actor `30/minute`; cropped packaging-label data only; one synthetic no-PII Vision smoke; `main` push/deploy; ChinaTech-only Vision activation; authenticated phone/desktop verification.
- **Boundary:** order-text traffic remains active; deploy Vision dormant first. Only the one approved synthetic Vision request may be billable before the triple gate passes.
- **Frozen exclusions:** people, IDs, customer data, receipts/addresses, device screens, IMEI/SN/EAN, automatic writes, public AI, other stores, retries, and any model/budget expansion.

## Work packages

1. Latest-baseline reconciliation and Plan Delta.
2. Server sanitizer, idempotency, provider/error and budget hardening.
3. Pre-body abuse gate and privacy/UI copy.
4. Focused/full automated validation, mocked cloud E2E and screenshots.
5. Exact budget/privacy approval packet.
6. Approved production release, one-store smoke, observation and rollback-or-retain decision.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
