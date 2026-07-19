---
schema_version: 1
task_id: "TASK-20260720-001-ai-order-query-v4-release"
title: "AI 自然语言订单查询 V4 第一发布包"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["API", "ARCH", "DOC", "FE", "FLOW", "INT", "QA", "SEC"]
created_at: "2026-07-19T22:39:43Z"
updated_at: "2026-07-19T23:40:42Z"
---

# Task — AI 自然语言订单查询 V4 第一发布包

## Owner request

AI 自然语言订单查询 V4 第一发布包

## Business value

让员工以中文、意大利语或英语自然查询订单，获得可解释且与设备日期业务条件一致的结果，并在当前对话页继续浏览。

## Scope in

- 将大模型搜索计划升级为带原文证据的候选合同；服务端只执行可在原句中定位且通过字段语义验证的条件。
- 保留本地规则作为确定性快路径，并允许模型在受控词表内补充本地快路径尚未覆盖的安全同义表达。
- 结果分页使用 actor/store 绑定、短时效、加密密封并经 HMAC 签名的 continuation token；续页不再次调用模型或重复计费，浏览器不能读取查询计划。
- AI Sheet 从当前文档语言解析 `zh-CN`、`it-IT`、`en`，并让语音与查询请求使用同一 locale。
- 在当前对话中显示累计结果、精确范围和“继续加载”，不自动跳转订单；订单页只在员工明确点击时打开。
- 建立版本化中英意离线自然语言评测集及攻击/歧义负面集，作为发布门禁。
- 更新权威 AI 运行文档、发布/回滚证据、截图和任务记忆。

## Scope out

- 数据库 schema、迁移、回填或 Supabase 权限变化。
- 启用或扩展对话内业务写操作、自动采购、付款、库存扣减、客户消息或批量变更。
- 公共客户 AI、多门店扩展、模型/预算/配额/价格/密钥调整。
- 把原始订单结果、客户 PII、IMEI、完整工单号或数据库 ID 回传模型。
- 任意 SQL、模型自由生成业务事实、后台持续 Agent 或持久聊天。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Work only in `/private/tmp/repairdesk-ai-v4-20260720`; preserve the dirty root checkout.
- Reuse the existing server-side key without reading, logging, rotating, copying, or committing it.
- Keep `AI_ORDER_INLINE_ACTIONS_ENABLED` and public/customer AI behavior unchanged.
- Exact-SHA production release requires quality, security, orchestration, deployment and smoke evidence.

## Acceptance criteria

- [x] 模型的每个非默认约束都携带原句证据；伪造、缺失、冲突或不可验证约束在 repository 前被拒绝或由本地可信约束纠正。
- [x] 模型可补充至少付款、队列、维修项目、配件和完成状态的受控三语同义表达；自由搜索、客户/订单标识仍留在本地或手工路径，不扩大门店/RBAC/PII 边界。
- [x] 版本化中英意自然语言评测集不少于 300 条，覆盖设备、任意日期、付款、维修项目、配件、组合、歧义和攻击输入。
- [x] 聊天从实际文档语言解析 locale，语音与请求一致；不支持语言安全回退 `zh-CN`。
- [x] 查询结果可在当前对话连续加载；续页绑定同一 actor/store/计划且不再次调用 provider 或扣付费额度。
- [x] 每批与累计数量、实际范围、精确日期和条件来源可见；只有显式点击才跳转订单。
- [x] 生产写操作、公共客户 AI、模型预算、密钥和数据库结构保持不变。
- [ ] lint、typecheck、test、build、目标 E2E、安全审查和生产 smoke 通过后才关闭。

## Facts, assumptions, and unknowns

| Item                                                            | Type                    | Evidence                                                         | Status / next action          |
| --------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- | ----------------------------- |
| V3 model plan is rebuilt entirely from local trusted extraction | observed                | `order-assistant.service.ts:461-495`                             | root cause confirmed          |
| UI request locale is hard-coded `zh-CN`                         | observed                | `ai-assistant-sheet.tsx:192`                                     | replace with bounded resolver |
| Search always requests page 1                                   | observed                | `order-assistant.service.ts:308-331`                             | add signed continuation       |
| Structured Outputs validates shape, not business truth          | external fact           | official OpenAI Structured Outputs guide                         | keep server semantic compiler |
| Existing production key and HMAC secret configuration           | observed without values | server env presence gate                                         | reuse; never expose           |
| Database changes needed                                         | observed false          | current `OrderListPageInput` already supports page/filter inputs | no migration                  |

## Decision and approval points

- **R4 / L1**: external model semantics and production release can affect staff decisions; execution stays bounded and review-heavy.
- Owner approved implementation, push, deployment and application in this thread (D4 release authority for this no-migration, read-only slice).
- Owner previously approved reuse of the existing key; no key/model/budget mutation is authorized.
- Any DB, permission, PII, production write, public AI or provider-policy expansion requires a new decision.

## Work packages

1. Query contract V4, evidence schema and closed-world semantic compiler.
2. Signed continuation contract and provider-free paging path.
3. Locale resolver and compact in-chat load-more UX.
4. Versioned 300+ case multilingual evaluation corpus and focused regression tests.
5. Security/RBAC/PII/adversarial review, responsive E2E and documentation sync.
6. Exact-SHA integration, push, Vercel production deployment, smoke, observation and rollback evidence.

## Agent decision

- **No spawn**: the platform-level collaboration rule permits sub-agents only when the user explicitly requests them. The owner requested execution but not sub-agents, so the Integration Lead performs the scoped implementation and reviews in the main thread.
- Departments are considered for the checklists above but are not reported as spawned AI employees.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
