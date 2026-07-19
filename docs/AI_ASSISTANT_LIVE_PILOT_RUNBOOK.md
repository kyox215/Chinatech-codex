# RepairDesk AI 小助手真实 API 试点发布手册

Status: D4 smoke halted and rolled back; production NO-GO pending revised Owner D4
Task: `TASK-20260718-014-ai-assistant-live-pilot`
Last verified: 2026-07-19 CEST

## 当前结论

真实 OpenAI adapter、durable Supabase 预算网关、数据外发门禁、HMAC 幂等/短窗限流、审计和维护任务已经部署到生产，但所有用户可见 AI 功能旗标仍关闭。生产已应用 `20260718223739_ai_assistant_live_provider_v1.sql`，Production secrets 已安全上传，维护 cron 路由修复已部署到 `bc5dfae3`。

原 D4 唯一一次无 PII 计费 smoke 已执行：预算先预留 `308 micro-USD`，随后按真实 usage 结算 `123 micro-USD`（399 input / 256 output Token，约 `$0.000123`），Safety ID、单次 provider attempt、审计和账本都正常。服务最终返回 `AI_PROVIDER_PROTOCOL_ERROR`，因此没有开启 ChinaTech canary，并立即把 `ai-runtime-v1` policy 回滚为 `disabled`。当前 AI 请求账本保留 1 条已结算记录；不存在未结算 reservation。

根因是 `gpt-5-nano-2025-08-07` 属于 reasoning 模型；v1 未指定 reasoning effort，默认 medium，而 `max_output_tokens=256` 同时覆盖推理和可见输出。真实调用刚好用满 256 output Token，未形成所需函数调用。修复候选 `ai-runtime-v2` 显式设置 `reasoning.effort=minimal`，模型、价格、Token 上限和总预算均不变；在新的 D4 批准第二次计费 smoke 前不得启用。

第一轮 canary 推荐只开放员工订单文字，且只允许不含 PII/设备标识符的通用筛选；`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0`、`AI_VISION_INTAKE_ENABLED=0` 必须继续保持。照片外发需在有可证明的裁切/数据范围和独立隐私决定后另开 D4。

## 原 D4 决策记录（已执行至停止条件）

1. **Canary 门店**：只读生产查询已确认 7 家 active 店铺；建议唯一 canary 为 `ChinaTech`（`5248dda1-2b32-46cd-8ed0-d15386a9e8ed`）。Owner 仍需确认选择，不得自动扩到其余 6 店。
2. **预算**：建议 `$50/月`、每店 `20` 次订单文字/日、`10` 次图片/日、全局 `300` 次/日、每 actor `30` 次/分钟、`Europe/Rome`。10 店全部用满的预留上限约 `$0.8731/天`、`$26.193/30天`。
3. **数据范围**：文字和图片分别批准。文字只允许通用筛选；完整订单号走本地直查；姓名、电话、邮箱、IMEI/SN、证件、支付资料禁止外发。第一轮图片建议不批准。
4. **隐私与合同**：确认 DPA/Article 28、法律基础、员工告知、数据区域/跨境、ZDR 或 Modified Abuse Monitoring 资格。`store:false` 不等于 ZDR；默认 abuse-monitoring 日志可能保留输入/输出最多约 30 天。
5. **模型与价格**：原批准为 `ai-runtime-v1` / `openai-pricing-2026-07-18`，订单 `gpt-5-nano-2025-08-07`，图片 `gpt-4o-mini-2024-07-18`；v1 已因真实 smoke 失败而停用。
6. **迁移**：`20260718223739_ai_assistant_live_provider_v1.sql` 已单独应用并通过 history、RLS、grant、RPC 与 advisor 验证；不得改写或重放。
7. **Vercel**：Production secrets 与休眠环境合同已上传；维护 cron 每日 `02:17 UTC`，未授权请求现在直接返回 401，不再被登录中间件重定向。
8. **发布**：代码已推送并以休眠旗标部署；唯一计费 smoke 命中停止条件，canary 和 30 分钟观察没有开始。

## 下一次 D4 必须重新确认

1. 批准 `ai-runtime-v2`：只新增 `reasoning.effort=minimal`，模型、定价、256 output Token 上限和 `$50/月` 上限不变。
2. 批准插入并 attestation 一条新的 v2 disabled policy；原 v1 永久保持 disabled，第一条已结算账本继续保留。
3. 批准把 Vercel `AI_ASSISTANT_POLICY_VERSION` 更新为 v2，并先以全部功能旗标关闭的方式部署 exact SHA。
4. 批准第二次且仅一次合成无 PII 计费 service-path smoke。只有 HTTP 200、ledger `succeeded`、provider attempt=1、audit `succeeded` 同时满足，才进入 ChinaTech 单店激活。
5. 重新批准 ChinaTech-only staff order text canary 与 30 分钟观察；vision、draft apply、public assistant、PII 和第二店继续禁止。

## 生产环境合同

下一版非秘密值提案如下；未获得新的 D4 前不得把 v2 policy 或 live flags 写入生产：

```dotenv
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=1
AI_ASSISTANT_DURABLE_QUOTA_BACKEND=supabase-v1
AI_ASSISTANT_POLICY_VERSION=ai-runtime-v2
AI_ASSISTANT_PRICING_VERSION=openai-pricing-2026-07-18
AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD=50000000
AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY=20
AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY=10
AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY=300
AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE=30
AI_ASSISTANT_QUOTA_TIMEZONE=Europe/Rome
OPENAI_AI_ASSISTANT_ORDER_MODEL=gpt-5-nano-2025-08-07
OPENAI_AI_ASSISTANT_VISION_MODEL=gpt-4o-mini-2024-07-18
OPENAI_API_BASE_URL=https://api.openai.com/v1
AI_ASSISTANT_USAGE_RETENTION_DAYS=90
```

以下值是 Production-only secrets，只能通过平台 secret store 写入：`OPENAI_API_KEY`、`AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET`、`AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET`、`CRON_SECRET`。三个 HMAC/Cron secret 必须各自独立且至少 32 字符。任何值都不得进入 Git、命令输出、任务记忆、截图或前端 `NEXT_PUBLIC_*`。

功能旗标在部署与边界 smoke 期间仍保持：

```dotenv
AI_ASSISTANT_ENABLED=0
AI_ORDER_READ_TOOLS_ENABLED=0
AI_VISION_INTAKE_ENABLED=0
AI_DRAFT_APPLY_ENABLED=0
AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=0
AI_ASSISTANT_STORE_ALLOWLIST=
AI_ASSISTANT_MAINTENANCE_ENABLED=0
```

## v2 修复候选发布顺序

1. 确认隔离分支 diff 只有 v2 reasoning 修复、测试、任务记忆和本手册；完成 agents/lint/typecheck/test/build、secret scan 与 diff review。
2. 保持当前生产 `AI_ASSISTANT_ENABLED=0`、order/vision/draft/public/maintenance 全部关闭，v1 policy 为 disabled；不再执行任何 billable 调用。
3. 新 D4 后插入 disabled v2 policy，完整 attestation 通过后更新 Vercel policy version，并以全部 live flags 关闭部署 exact SHA。
4. 在 v2 policy 临时 enabled 后，只通过正式订单服务执行第二次唯一的合成无 PII smoke；禁止 provider 直连或自动重试。
5. 如果 smoke 不是 HTTP 200、ledger `succeeded`、audit `succeeded`，立即保持 flags off、停用 v2 policy 并结束发布。
6. 如果 smoke 全绿，只把 `5248dda1-2b32-46cd-8ed0-d15386a9e8ed` 写入 allowlist，再开启 `AI_ASSISTANT_ENABLED=1` 与 `AI_ORDER_READ_TOOLS_ENABLED=1`。Vision、draft apply、public assistant 继续关闭。
7. 观察 30 分钟：请求/错误/取消、预留/结算/hold、Token、micro-USD、延迟桶、审计可用性和手工 fallback。再观察 24 小时后决定保留或扩大；扩大门店或开放 vision 是新的 D4。

## 立即停止条件

出现任一条件立即把 `AI_ASSISTANT_ENABLED=0` 并重新部署：

- actor/store 越权、真实 PII/图片/secret 进入日志或审计；
- 任何未预留 provider dispatch，或环境/数据库政策 attestation 不一致；
- 连续结算失败、unknown holds 无法由维护任务收敛、费用 overrun 自动停用政策；
- Provider 5xx/429 或端到端失败率在观察窗口超过 5%，或 p95 超过文字 12 秒目标；
- 手工查询/手工入库 fallback 不可用。

回滚顺序：关闭具体子旗标 → `AI_ASSISTANT_ENABLED=0` → 回退应用 exact SHA → 将 enabled 政策设为 `disabled`。不要紧急 DROP 账本；保留并结算已有 reservation。怀疑 key 泄露时，在 OpenAI Platform 轮换 key，再更新 Vercel secret 并重新部署。
