# ADR-20260718-001: RepairDesk 有界 AI 小助手采用现有 BFF 与无写工具边界

- Status: accepted for ChinaTech employee order text; Vision/PII/write/public/multi-store activation remains blocked
- Date: 2026-07-18
- Decision owners: Integration Lead; Owner retains live-data, dependency, budget and production decisions
- Related tasks: `TASK-20260718-009-ai-assistant-implementation`, `TASK-20260718-011-ai-assistant-cost-governance`, `TASK-20260718-014-ai-assistant-live-pilot`
- Supersedes: none

## Context

RepairDesk 需要为已登录员工增加订单自然语言查询，并把设备标签照片识别成可编辑库存草稿。系统已有 Next.js Node BFF、Supabase actor/store 注入、权限矩阵、订单/库存服务、审计、条码/OCR 与人工保存流程。风险集中在跨店泄露、第三方数据处理、模型幻觉触发写入、图片攻击、秘密泄露和重复写入。

## Decision drivers

- 模型不能扩大当前角色、门店或字段权限。
- 订单事实必须来自 RepairDesk 服务，而不是模型记忆。
- AI 失败时门店仍能完成原有手工流程。
- API Key 和服务商错误只存在于服务端。
- Phase 1/2 不引入持久聊天或模型直接业务写入。
- 生产数据、依赖、预算、迁移和公开激活必须独立批准。

## Considered options

### Option A — 现有 Next.js BFF + 项目内 provider + 官方 OpenAI Node SDK

复用当前 auth/store/permission/service/audit 边界；provider 隔离供应商协议。SDK 只在依赖批准后加入，并配置 `maxRetries: 0`，由应用控制总 deadline 和有限重试。

### Option B — 现有 BFF + 原生 `fetch`

依赖最少，但要自行维护 Responses API 类型、错误、request ID、协议演进和重试语义。

### Option C — 独立 AI 服务或 Agents SDK

需要重复身份传递、门店授权、部署、审计和观测；对 Phase 1/2 没有足够收益，并扩大攻击面。

## Decision

选择 Option A，但分两层生效：

1. 现在允许实现 provider interface、严格合同、fake provider、默认关闭 flags、UI、合成测试和无外部调用的业务编排。
2. `openai` SDK 与服务器图片解码依赖 `sharp` 属于待 Owner 批准的依赖变更；批准前不加入生产依赖、不进行 live 调用。

Phase 1 采用“模型只规划、服务器直接回答”模式：

- 模型只能选择 `search_orders`、`get_order_summary` 或澄清意图。
- 工具参数 `.strict()`，JSON Schema 所有对象 `additionalProperties:false`。
- `actor_id`、`store_id`、真实数据库 ID 不进入模型参数。
- 服务器在当前 actor/store 权限内执行现有查询，并直接生成有限业务卡片。
- MVP 不把订单工具结果回传模型，因此不把客户/订单事实再次发送给供应商。
- 不注册任何写工具、SQL、Web、MCP、Files、Conversations 或 background mode。

Phase 2 使用严格 Structured Output，不注册工具。服务器先安全解码/定向/清元数据/重编码，再合并本地条码、OCR、Luhn 与视觉候选。AI 只产生候选；员工明确复核后才应用到页面内存表单，正式保存仍走现有库存服务。

## Consequences

### Positive

- 复用已验证的门店隔离和权限边界。
- 模型没有正式写入能力，业务卡不能由自由文本伪造。
- 工具结果不回传模型，Phase 1 的第三方数据面更小。
- fake/live provider 可替换，测试不需要 Key 或网络。
- 手工路径、现有表单和现有 API 保持权威。

### Negative / trade-offs

- 自然语言答案首版较模板化，不是开放式多步 Agent。
- 需要精确 capability 投影、服务端配额和 AI 专用审计 allowlist。
- 安全图片处理需要额外服务器依赖或等价受审实现。
- `store:false` 仍不等于 ZDR，live 使用继续受隐私审批阻断。

## Risks and mitigations

- 跨店 ID：服务器忽略请求/模型中的 store，所有查询复用 actor/store repository。
- prompt injection：消息、图片、OCR、二维码均是数据；无通用工具与写工具。
- 敏感日志：AI 审计只记录版本、计数、桶、状态和错误码。
- 成本失控：live provider 同时要求预算批准、正数门店日限额和分布式 quota。
- 图片攻击：只接受 JPEG/PNG/WebP；magic、真实解码、像素/帧、清元数据和重编码全部 fail closed。
- 供应商故障：60 秒总 deadline、有限重试、latest-intent-wins、保留人工入口。

## Validation plan

- 合同、strict Schema、feature flags、provider、审计 allowlist 单元测试。
- actor/store/permission + fake provider 集成测试。
- 跨店、viewer、技师 assigned scope 和模型恶意参数负面测试。
- 合成黄金图片、恶意 MIME/polyglot/EXIF/超像素/注入测试。
- 移动/桌面 E2E、无数据库写入断言和脱敏截图。
- 生产前独立 Security/Data/Release 复核。

## Revisit conditions

- Owner 批准 live 数据、预算、DPA/ZDR/MAM/EU residency 或依赖时。
- 需要模型读取工具结果、多轮状态、流式回答或第三方知识时。
- Phase 3 持久草稿/多标识符迁移进入执行门时。
- 公开客户助手单独立项和认证方案批准时。

## 2026-07-19 implementation update

The live implementation uses Option B's native server-side `fetch`, not the initially preferred SDK. The narrow Responses API surface is wrapped behind the same provider interface, injected fetch keeps the protocol independently testable, and no provider retry is permitted. This implementation choice is production-verified for ChinaTech employee order text only.

`ai-runtime-v1` remains disabled after its default-medium reasoning exhausted the 256-token output ceiling. Owner-approved `ai-runtime-v2` versions the remediation with explicit `reasoning.effort=minimal` while preserving model, pricing, token ceilings and budget. The v2 no-PII one-shot passed HTTP, ledger and audit; exact-SHA activation then passed a 30-minute observation.

This update does not authorize Vision/photos, PII, AI writes, a public/customer assistant, another store, provider-managed state or broader tools. Those remain separate R4/D4 decisions.
