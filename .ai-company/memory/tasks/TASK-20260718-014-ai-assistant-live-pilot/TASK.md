---
schema_version: 1
task_id: "TASK-20260718-014-ai-assistant-live-pilot"
title: "RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["API", "DATA", "DOC", "INT", "QA", "Release", "SEC"]
created_at: "2026-07-18T21:11:07Z"
updated_at: "2026-07-19T00:25:55Z"
---

# Task — RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度

## Owner request

RepairDesk AI 小助手 Phase 3B 单店真实 OpenAI API 灰度

## Business value

以单店、硬预算、可回滚方式启用真实 OpenAI 订单理解与包装标签识别，同时保护门店隔离、客户数据和库存写入边界。

## Scope in

- Implement a server-only OpenAI Responses API provider for order intent parsing and device-label recognition.
- Wire durable Supabase reservation/finalization around every paid provider dispatch while preserving free deterministic/local paths.
- Enforce store allowlist, RBAC, exact-model policy, privacy controls, timeout/token ceilings, one provider attempt, and fail-closed configuration.
- Add mocked provider/RPC/service tests, full repository quality gates, and a zero-cost real-key authentication check; keep the first billable no-PII smoke behind the durable production D4 gate.
- Prepare—but do not silently cross—the production migration, budget-policy, Vercel-secret, canary, observation, and rollback gates.
- After the first live smoke stopped the release, prepare a versioned `ai-runtime-v2` minimal-reasoning remediation candidate without a second billable call or canary activation.
- Keep all work isolated from the owner's dirty root checkout and produce a scoped release branch/commit.

## Scope out

- Automatic inventory writes, order mutations, refunds, payments, or other AI side effects.
- Arbitrary model tools, web access, code execution, or provider-managed conversation storage.
- Multi-store rollout, customer-PII live tests, or unbounded image uploads.
- Model/pricing-family migration in the same canary; it is tracked as a follow-up before the deprecated model removal date.
- Any production effect beyond the exact approved D4 packet: second store, vision, PII egress, automatic writes, model/budget changes, or destructive database rollback.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 真实 OpenAI provider 仅在完整配置、门店 allowlist、权限、预算和迁移门禁满足时工作；任何缺项失败关闭。
- [x] 订单确定性路径和本地完整识别保持 provider=0；仅保守 fallback 进入付费 provider。
- [x] OpenAI Responses API 请求使用 store=false、隐私保护 safety_identifier、结构化输出、单次尝试、硬超时和 Token 上限。
- [x] 密钥仅存在于 ignored 本地 env 与 Vercel encrypted Production secret store；Git、日志、截图和任务记忆中均无明文。
- [ ] 生产迁移与 secrets 已完成；v1 policy 在失败 smoke 后已停用，ChinaTech canary/live flags 从未激活。Owner 已批准 D4-v2；v2 policy、第二次 smoke、条件激活和 30 分钟观察正在串行执行。
- [x] agents/lint/typecheck/test/build、定向 provider 合同测试、安全审查、fake E2E、零费用真实 API 鉴权和生产未登录边界冒烟均通过；网页登录态验证受浏览器明确站点禁用限制。

## Facts, assumptions, and unknowns

| Item                                                                                                                                      | Type                  | Evidence                                                                                                       | Status / next action                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Phase 3A already has fake provider, strict contracts, RBAC/allowlist, privacy-safe audit, cost policy, and a dormant governance migration | observed              | `src/features/ai-assistant/server/*`; `supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql` | reuse; do not bypass                                                           |
| The current OpenAI factory intentionally fails closed and vision explicitly rejects non-fake providers                                    | observed              | `provider-factory.ts`; `vision-assistant.service.ts`                                                           | implement and remove only the intentional live block                           |
| Paid quota is currently process-local; the migration exposes service-role-only atomic reserve/finalize/release RPCs                       | observed              | `quota.ts`; governance migration                                                                               | add server-only durable adapter                                                |
| Owner approved creation/storage of a fresh OpenAI Platform key                                                                            | observed              | owner confirmation in main thread                                                                              | key exists only in ignored root `.env.local`; never copy to source/task memory |
| Production DB already applied dormant `20260718174042`; policy/bucket/request tables are all empty                                        | verified read-only    | linked migration history, REST count-only query, OpenAPI schema                                                | preserve history; apply only new upgrade after D4                              |
| Seven active stores exist; approved first canary is ChinaTech `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`                                      | verified + approved   | store metadata query; Owner D4 decision                                                                        | allowlist only this store                                                      |
| Existing exact model snapshots and pricing policy are versioned; the order snapshot has a future removal date                             | observed              | runtime/cost policy plus current official OpenAI docs                                                          | keep for first canary; create P1 upgrade before removal                        |
| Production caps are USD 50/month, 20 order calls/store/day, 300 global/day, 30/actor/minute, `Europe/Rome`; vision stays off              | approved              | Owner D4 decision                                                                                              | enforce through env attestation and durable policy                             |
| The exact live-provider migration is applied; Production secrets exist encrypted; dormant deployment `bc5dfae3` is READY                  | verified              | linked migration history, Vercel API/deployment events, unauthenticated route smoke                            | retain dormant application; all live flags remain off                          |
| The one approved billable smoke settled at 123 micro-USD but returned `AI_PROVIDER_PROTOCOL_ERROR`                                        | verified              | durable request ledger and audit metadata                                                                      | stop canary; v1 policy disabled; do not retry under the original D4            |
| GPT-5 nano default medium reasoning consumed the entire 256-token output ceiling before a function call                                   | inferred + documented | exact 256 output-token ledger plus official OpenAI reasoning/incomplete guidance                               | version remediation as v2 with explicit `reasoning.effort=minimal`             |

## Decision and approval points

- **D1 / approved:** isolated local implementation, mocked tests, and zero-cost real-key authentication.
- **D4 / approved:** apply only the new linked production upgrade migration and seed/attest/enable the exact initial pricing/budget policy.
- **D4 / approved:** upload Production-only secrets, allowlist ChinaTech only, and enable staff order-text flags; vision/draft/public flags stay off.
- **D4 / approved:** push, deploy, run one no-PII service-path billable smoke, observe for 30 minutes, and retain or roll back by the written thresholds.
- **D4 / executed and stopped:** the single smoke was billable and durably settled but failed end to end; rollback threshold fired before canary activation.
- **D4-v2 / approved 2026-07-19:** reuse the existing encrypted key; deploy `ai-runtime-v2`; create and verify the v2 policy; execute exactly one additional synthetic no-PII billable smoke; activate ChinaTech-only staff order text only after HTTP, ledger, and audit all succeed; observe for 30 minutes.
- **D4-v2 exclusion boundary:** vision, automatic writes, public/customer assistant, PII egress, and every other store remain disabled.
- **Boundary:** USD 50/month; 20 order-text calls/store/day; 300 calls/day globally; 30 calls/actor/minute; `Europe/Rome`; one store only.

## Work packages

1. Intake, evidence recovery, official OpenAI/Supabase documentation check, and independent architecture/security/QA review.
2. Native-fetch OpenAI provider with structured outputs and privacy/cost controls.
3. Durable Supabase budget gateway and paid-service lifecycle integration.
4. Mocked contract, service, failure-path, migration, and repository validation.
5. Zero-cost real-key authentication with sanitized evidence; first billable no-PII service-path smoke remains in package 6.
6. Explicit production approval packet, then only if approved: migration/policy/secrets/canary/deployment/observation/rollback.
7. Documentation, task memory, visual evidence or documented no-page reason, scoped commit, and formal closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
