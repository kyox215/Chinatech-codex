# RepairDesk AI 小助手真实 API 试点发布手册

Status: ChinaTech staff order text live; ledger-fence hotfix applied and observed
Task: `TASK-20260718-014-ai-assistant-live-pilot`
Last verified: 2026-07-20 CEST, incident task `TASK-20260720-006-ai-ledger-fence-hotfix`

## 当前结论

真实 OpenAI adapter、durable Supabase 预算网关、数据外发门禁、HMAC 幂等/短窗限流、审计和维护任务已经部署到生产。ChinaTech 单店员工订单文字 AI 按既有配置开放：`AI_ASSISTANT_ENABLED=1`、`AI_ORDER_READ_TOOLS_ENABLED=1`，allowlist 只有 `5248dda1-2b32-46cd-8ed0-d15386a9e8ed`。2026-07-20 的账本围栏事故已由迁移 `20260720065246` 修复，并通过唯一一次无 PII canary 与 15 分钟观察。Vision、draft apply、public/customer assistant、PII 外发和其他店铺仍关闭。

## 多店铺应用代码状态（2026-07-24）

`TASK-20260724-001-multistore-feature-availability` 把“门店可使用订单助手”和“门店可调用外部模型”拆成两个独立发布面；没有改变当前生产配置：

- `AI_ORDER_ASSISTANT_ALL_STORES_ENABLED=1` 可让所有非 denylist 门店使用本地、确定性、actor/store-scoped 的只读订单查询。
- `AI_ORDER_PROVIDER_STORE_ALLOWLIST` 是外部文字模型的精确门店白名单。未命中时，强制选择模型也只返回本地澄清，不创建 provider、预算预留或外发请求。
- 现有 `AI_ASSISTANT_STORE_ALLOWLIST` 继续作为 Vision、draft apply、inline action 和兼容 provider 的试点边界；全店铺只读开关不会扩大这些能力。
- AI 面板会在当前门店无 provider 权限时隐藏“大模型辅助”选择，并明确说明只使用本地处理。
- denylist 始终优先；`*` 没有通配语义。viewer 和原有业务权限拒绝仍保持失败关闭。

当前代码只实现安全的“所有店铺本地只读可用”。任何新增门店的外部模型、图片外发、AI 写入或公开客户助手，仍需独立 D4 数据/隐私/预算/生产批准和真实门店 canary。

## 2026-07-20 用量账本围栏事故与已应用修复

生产迁移 `20260720013000_store_lifecycle_business_fence_and_close_recheck.sql` 把通用门店生命周期触发器绑定到所有含 `store_id` 的业务表。`ai_assistant_usage_buckets` 是混合范围表：`store_day` 必须有门店，而 `global_day/global_month` 按原始约束必须使用空 `store_id`。通用触发器把合法全局桶误判为 `STORE_LIFECYCLE_STORE_REQUIRED`，因此预算预留在调用 OpenAI 前失败关闭。

事故窗口内订单接口的 503、数据库错误和审计数量一致；失败审计均为 `model_version=not_started`，且没有新增 usage request，所以失败查询没有产生 provider 调用或费用。生产聚合预检同时确认 `reserved=0`、非活动门店 `reserved=0`、过期 `reserved=0`，没有待人工清理的遗留预留。

前向修复 `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` 已应用生产；它没有改写已应用迁移、额度、价格、模型、RLS 或 grants：

- 保留原触发器名称，但只在 AI 混合桶表调用专用函数；仅 `global_day/global_month + request_kind=all` 可为空门店。
- 冻结全局桶 identity 并禁止全局桶删除；门店桶继续取得共享门店锁，并要求门店状态和生命周期均为 active。
- lifecycle 离开 active 前取得同键排他锁；只要存在未结算 provider reservation，就以现有 `STORE_LIFECYCLE_BLOCKED` 合同回滚整笔关店。
- PostgreSQL 17 已验证迁移连续应用两次、订单/视觉 reserve 与结算、release、stale settlement、closing-store 零半写，以及 reserve-first / close-first 两种并发顺序。

Owner 批准后，迁移通过 linked workflow 单独应用；history 新增且仅新增 `20260720065246`，热修复后的 dry-run 返回远端已是最新。两个 trigger 均仅绑定一次到预期专用函数，`anon`/`authenticated` 无执行权，AI 表 RLS 与浏览器 grants 未漂移。不得借本事故顺带修改 flags、policy、secret、Vision、Vercel 应用或其他数据库对象。

应用后的零费用目录检查已通过。唯一一次不含 PII 的正常 service-path 订单文字 canary 返回 HTTP 200，request `961f26bf-5e56-44a8-90da-c19ebe794a63` 最终 `succeeded`，仅有 1 次 provider attempt，按真实 usage 结算 `130 micro-USD`，账本三种 scope 与审计全部收敛。随后 15 分钟共 16 次轮询保持 0 open、0 bad、0 cross-store、0 reserved、0 overrun、0 观察窗口异常审计和 0 Vercel runtime error。未执行 Vision smoke。若未来复发，回滚采用新的补偿迁移或关闭 AI flags；不得删除账本或修改 migration history。

原 D4 唯一一次无 PII 计费 smoke 已执行：预算先预留 `308 micro-USD`，随后按真实 usage 结算 `123 micro-USD`（399 input / 256 output Token，约 `$0.000123`），Safety ID、单次 provider attempt、审计和账本都正常。服务最终返回 `AI_PROVIDER_PROTOCOL_ERROR`，因此没有开启 ChinaTech canary，并立即把 `ai-runtime-v1` policy 回滚为 `disabled`。当前 AI 请求账本保留 1 条已结算记录；不存在未结算 reservation。

根因是 `gpt-5-nano-2025-08-07` 属于 reasoning 模型；v1 未指定 reasoning effort，默认 medium，而 `max_output_tokens=256` 同时覆盖推理和可见输出。v2 显式设置 `reasoning.effort=minimal`，模型、价格、Token 上限和总预算均不变。D4-v2 的唯一追加 smoke 已验证修复：HTTP 200，399 input / 60 output Token，1 provider attempt，结算 44 microUSD，ledger/audit 均 succeeded。

ChinaTech 激活部署为 `main@152caa1c` / Vercel `dpl_946N6xMftqrRpKTzGmnDBmbjrR2y`，READY 时间 `2026-07-19T00:58:50.334Z`。完整观察到 `01:28:56.132Z`：累计 2 请求 / 2 attempts / 167 microUSD，0 open、0 bad、0 overrun、0 Vision、0 跨店、0 scoped runtime error。窗口内没有真实员工新请求，因此它证明空闲稳定性和边界保持；实际服务路径由 v2 one-shot 证明。

第一轮 canary 只开放员工订单文字，且只允许不含 PII/设备标识符的通用筛选；`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0`、`AI_VISION_INTAKE_ENABLED=0` 必须继续保持。照片外发需在有可证明的裁切/数据范围和独立隐私决定后另开 D4。

2026-07-19 已准备独立的 Vision 安全候选和批准包，但尚未改变 Vision 生产状态。D4-v2 明确排除照片外发；Vision 必须取得独立 D4，并复用本手册已批准的 `$50/月` v2 共享政策数字，除非 Owner 另行批准新的版本化 policy。Vision 任务不得与本任务的生产写锁、smoke 或观察并发。

## 原 D4 决策记录（已执行至停止条件）

1. **Canary 门店**：只读生产查询已确认 7 家 active 店铺；建议唯一 canary 为 `ChinaTech`（`5248dda1-2b32-46cd-8ed0-d15386a9e8ed`）。Owner 仍需确认选择，不得自动扩到其余 6 店。
2. **预算**：建议 `$50/月`、每店 `20` 次订单文字/日、`10` 次图片/日、全局 `300` 次/日、每 actor `30` 次/分钟、`Europe/Rome`。10 店全部用满的预留上限约 `$0.8731/天`、`$26.193/30天`。
3. **数据范围**：文字和图片分别批准。文字只允许通用筛选；完整订单号走本地直查；姓名、电话、邮箱、IMEI/SN、证件、支付资料禁止外发。第一轮图片建议不批准。
4. **隐私与合同**：确认 DPA/Article 28、法律基础、员工告知、数据区域/跨境、ZDR 或 Modified Abuse Monitoring 资格。`store:false` 不等于 ZDR；默认 abuse-monitoring 日志可能保留输入/输出最多约 30 天。
5. **模型与价格**：原批准为 `ai-runtime-v1` / `openai-pricing-2026-07-18`，订单 `gpt-5-nano-2025-08-07`，图片 `gpt-4o-mini-2024-07-18`；v1 已因真实 smoke 失败而停用。
6. **迁移**：`20260718223739_ai_assistant_live_provider_v1.sql` 已单独应用并通过 history、RLS、grant、RPC 与 advisor 验证；不得改写或重放。
7. **Vercel**：Production secrets 与休眠环境合同已上传；维护 cron 每日 `02:17 UTC`，未授权请求现在直接返回 401，不再被登录中间件重定向。
8. **发布**：代码已推送并以休眠旗标部署；唯一计费 smoke 命中停止条件，canary 和 30 分钟观察没有开始。

## D4-v2 已完成的批准项

1. `ai-runtime-v2` 只新增 `reasoning.effort=minimal`；模型、定价、256 output Token 上限和 `$50/月` 上限未变。
2. v2 policy 先以 disabled exact copy 创建，`policy_ready` 后才 enabled；v1 保持 disabled，历史账本保留。
3. Vercel `AI_ASSISTANT_POLICY_VERSION` 已更新为 v2，先休眠部署 exact SHA，再执行 one-shot。
4. 第二次且仅一次合成无 PII service-path smoke 同时满足 HTTP 200、ledger succeeded、attempt=1、audit succeeded。
5. ChinaTech-only staff order text 已激活并通过 30 分钟观察；Vision、draft apply、public assistant、PII 和第二店继续禁止。

## 生产环境合同

下一版非秘密值合同如下；D4-v2 已批准，但只能按本手册的串行门禁写入生产：

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

当前生产功能旗标合同：

```dotenv
AI_ASSISTANT_ENABLED=1
AI_ORDER_READ_TOOLS_ENABLED=1
AI_ORDER_INLINE_ACTIONS_ENABLED=0
AI_VISION_INTAKE_ENABLED=0
AI_DRAFT_APPLY_ENABLED=0
AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=0
AI_ORDER_ASSISTANT_ALL_STORES_ENABLED=0
AI_ORDER_ASSISTANT_STORE_DENYLIST=
AI_ORDER_PROVIDER_STORE_ALLOWLIST=5248dda1-2b32-46cd-8ed0-d15386a9e8ed
AI_ASSISTANT_STORE_ALLOWLIST=5248dda1-2b32-46cd-8ed0-d15386a9e8ed
AI_ASSISTANT_MAINTENANCE_ENABLED=1
```

以上三个新增变量是下一次部署应采用的应用合同；本任务未写入 Vercel Production。为保持现状，`ALL_STORES_ENABLED` 必须继续为 `0`，provider allowlist 只列现有已批准门店。

`AI_ORDER_INLINE_ACTIONS_ENABLED=0` 是 Order Query V4 的硬门禁。查询结果可在对话内展开和连续加载，并只通过明确链接打开订单；生产不会出现或执行“标记已订件”。续页复用既有请求指纹 secret 的短时加密密封与签名，不改变模型、预算、配额、数据批准或数据库政策。启用写旗标仍属于新的 D4 生产写决策，不包含在当前 ChinaTech 只读文字 canary 批准内。

## v2 已执行发布顺序

1. 确认隔离分支 diff 只有 v2 reasoning 修复、测试、任务记忆和本手册；完成 agents/lint/typecheck/test/build、secret scan 与 diff review。
2. 保持当前生产 `AI_ASSISTANT_ENABLED=0`、order/vision/draft/public/maintenance 全部关闭，v1 policy 为 disabled；不再执行任何 billable 调用。
3. 新 D4 后插入 disabled v2 policy，完整 attestation 通过后更新 Vercel policy version，并以全部 live flags 关闭部署 exact SHA。
4. 在 v2 policy 临时 enabled 后，只通过正式订单服务执行第二次唯一的合成无 PII smoke；禁止 provider 直连或自动重试。
5. 如果 smoke 不是 HTTP 200、ledger `succeeded`、audit `succeeded`，立即保持 flags off、停用 v2 policy 并结束发布。
6. 如果 smoke 全绿，只把 `5248dda1-2b32-46cd-8ed0-d15386a9e8ed` 写入 allowlist，再开启 `AI_ASSISTANT_ENABLED=1` 与 `AI_ORDER_READ_TOOLS_ENABLED=1`。Vision、draft apply、public assistant 继续关闭。
7. 已观察完整 30 分钟：请求/错误、预留/结算、Token、micro-USD、审计和运行错误均通过。24 小时后只做一次只读复核；扩大门店或开放 Vision 是新的 D4。

## 全店铺本地只读发布顺序（待 D4）

1. 先保持 provider allowlist、Vision、draft、inline actions 和 public assistant 不变，仅部署应用代码。
2. 用第二个真实门店账号验证本地确定性查询、viewer 拒绝、店铺切换和无 provider/无预算记录；不得使用 E2E system actor 代替租户证明。
3. 将异常门店加入 `AI_ORDER_ASSISTANT_STORE_DENYLIST`，确认该门店入口消失且其他门店不受影响。
4. 取得 Owner 的生产开关批准后，才可设 `AI_ORDER_ASSISTANT_ALL_STORES_ENABLED=1`；观察期间 provider allowlist 不扩大。
5. 若未来扩大 provider，必须逐店加入 `AI_ORDER_PROVIDER_STORE_ALLOWLIST`，重新核对隐私告知、当前共享月度硬预算和每店日额度。现有实现没有“每店独立月预算”，不得在报告中这样描述。

## 立即停止条件

出现任一条件立即把 `AI_ASSISTANT_ENABLED=0` 并重新部署：

- actor/store 越权、真实 PII/图片/secret 进入日志或审计；
- 任何未预留 provider dispatch，或环境/数据库政策 attestation 不一致；
- 连续结算失败、unknown holds 无法由维护任务收敛、费用 overrun 自动停用政策；
- Provider 5xx/429 或端到端失败率在观察窗口超过 5%，或 p95 超过文字 12 秒目标；
- 手工查询/手工入库 fallback 不可用。

回滚顺序：关闭具体子旗标 → `AI_ASSISTANT_ENABLED=0` → 回退应用 exact SHA → 将 enabled 政策设为 `disabled`。不要紧急 DROP 账本；保留并结算已有 reservation。怀疑 key 泄露时，在 OpenAI Platform 轮换 key，再更新 Vercel secret 并重新部署。
