# RepairDesk AI 小助手真实 API 试点发布手册

Status: local release candidate; production NO-GO until Owner D4 approval
Task: `TASK-20260718-014-ai-assistant-live-pilot`
Last verified: 2026-07-18 CEST

## 当前结论

真实 OpenAI adapter、durable Supabase 预算网关、数据外发门禁、HMAC 幂等/短窗限流、审计和维护任务已经在隔离分支实现。生产已应用 dormant Phase 3A migration，但治理表当前均为 0 行且没有 enabled policy；新的 live-provider upgrade、Vercel secrets、live flags、push、deploy 和计费 smoke 尚未批准，当前生产行为不变。

第一轮 canary 推荐只开放员工订单文字，且只允许不含 PII/设备标识符的通用筛选；`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0`、`AI_VISION_INTAKE_ENABLED=0` 必须继续保持。照片外发需在有可证明的裁切/数据范围和独立隐私决定后另开 D4。

## D4 必须逐项确认

1. **Canary 门店**：只读生产查询已确认 7 家 active 店铺；建议唯一 canary 为 `ChinaTech`（`5248dda1-2b32-46cd-8ed0-d15386a9e8ed`）。Owner 仍需确认选择，不得自动扩到其余 6 店。
2. **预算**：建议 `$50/月`、每店 `20` 次订单文字/日、`10` 次图片/日、全局 `300` 次/日、每 actor `30` 次/分钟、`Europe/Rome`。10 店全部用满的预留上限约 `$0.8731/天`、`$26.193/30天`。
3. **数据范围**：文字和图片分别批准。文字只允许通用筛选；完整订单号走本地直查；姓名、电话、邮箱、IMEI/SN、证件、支付资料禁止外发。第一轮图片建议不批准。
4. **隐私与合同**：确认 DPA/Article 28、法律基础、员工告知、数据区域/跨境、ZDR 或 Modified Abuse Monitoring 资格。`store:false` 不等于 ZDR；默认 abuse-monitoring 日志可能保留输入/输出最多约 30 天。
5. **模型与价格**：批准 `ai-runtime-v1` / `openai-pricing-2026-07-18`，订单 `gpt-5-nano-2025-08-07`，图片 `gpt-4o-mini-2024-07-18`。建立 P1 升级任务，最迟 2026-11-01 完成订单模型替换验证，早于当前记录的 2026-12-11 removal 日期。
6. **迁移**：`20260718174042` 与三条 Inventory V2 migration 已在远端；不得改写或重放。只批准新的 `20260718223739_ai_assistant_live_provider_v1.sql`，apply 前再次确认 policy/bucket/request 表为空。
7. **Vercel**：确认目标 project/team、Production scope、Cron 可用性与观测权限。维护 cron 每日 `02:17 UTC` 运行；每次新预留前另有小批量 stale sweep，因此不依赖高频付费 cron。
8. **发布**：批准 push 分支/PR、生产迁移、政策 seed/enable、secret 上传、部署、一次无 PII 计费 smoke、canary 观察窗口和保留/回滚决定。

## 生产环境合同

非秘密值的提案如下；未批准前不得写入生产：

```dotenv
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=1
AI_ASSISTANT_DURABLE_QUOTA_BACKEND=supabase-v1
AI_ASSISTANT_POLICY_VERSION=ai-runtime-v1
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

## 发布顺序

1. 刷新远端 baseline，确认隔离分支 diff 只包含本任务，并完成 lint/typecheck/test/build、安全与 secret scan。
2. 对 linked Supabase 做只读 migration list/dry-run；确认旧治理与 Inventory V2 history 已匹配，并生成只含 `20260718223739` 的隔离发布单元。
3. 应用 upgrade 后核对 migration history、4 张私有表、6 个 RPC、RLS、表 grants 和 service-role-only execute grants；确认没有 enabled policy。
4. 插入一条 `disabled` 的精确政策，调用 attestation RPC；确认完全匹配后才把该政策切换为 `enabled`。
5. 上传 Production-only secrets 与非秘密合同值，部署时保持所有功能旗标关闭；先验证 capability、401/403、请求体上限、cron 401 与手工流程。
6. 做一次零费用 key/auth 检查。随后经 D4 批准，只通过正式订单服务执行一条合成无 PII 的计费文字查询；不得绕过 durable reserve 直接调用 provider。
7. 只把 `5248dda1-2b32-46cd-8ed0-d15386a9e8ed` 写入 allowlist，再开启 `AI_ASSISTANT_ENABLED=1` 与 `AI_ORDER_READ_TOOLS_ENABLED=1`。Vision、draft apply、public assistant 继续关闭。
8. 观察 30 分钟：请求/错误/取消、预留/结算/hold、Token、micro-USD、延迟桶、审计可用性和手工 fallback。再观察 24 小时后决定保留或扩大；扩大门店或开放 vision 是新的 D4。

## 立即停止条件

出现任一条件立即把 `AI_ASSISTANT_ENABLED=0` 并重新部署：

- actor/store 越权、真实 PII/图片/secret 进入日志或审计；
- 任何未预留 provider dispatch，或环境/数据库政策 attestation 不一致；
- 连续结算失败、unknown holds 无法由维护任务收敛、费用 overrun 自动停用政策；
- Provider 5xx/429 或端到端失败率在观察窗口超过 5%，或 p95 超过文字 12 秒目标；
- 手工查询/手工入库 fallback 不可用。

回滚顺序：关闭具体子旗标 → `AI_ASSISTANT_ENABLED=0` → 回退应用 exact SHA → 将 enabled 政策设为 `disabled`。不要紧急 DROP 账本；保留并结算已有 reservation。怀疑 key 泄露时，在 OpenAI Platform 轮换 key，再更新 Vercel secret 并重新部署。
