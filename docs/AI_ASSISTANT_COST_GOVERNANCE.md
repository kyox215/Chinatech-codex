# RepairDesk AI 小助手成本治理与运行合同

Status: order-text provider path restored after verified ledger-fence hotfix; Vision remains off
Owner: Integration Lead / Architecture / DATA / Security
Last verified: 2026-07-20 CEST, `TASK-20260720-006-ai-ledger-fence-hotfix`

## 当前结论

Phase 3B 已实现真实 OpenAI Responses API 适配器、Supabase durable 预算网关、请求幂等指纹、外发数据门禁、分布式 actor 限流和保留期维护。生产已经应用 `20260718174042` 与 `20260718223739`；第一次 v1 无 PII 订单文字 smoke 结算 `123 micro-USD` 后安全停止，第二次已批准的 v2 订单文字 smoke 在单次尝试中以 HTTP 200、账本/审计成功结算 `44 micro-USD`。最新权威检查点无开放 reservation、Vision 请求或其他门店请求；Vision 仍关闭。

2026-07-20 的生产生命周期 writer fence 与全局 AI 桶的合法空门店设计发生冲突：`global_day/global_month` 在 provider dispatch 前被通用触发器以 `STORE_LIFECYCLE_STORE_REQUIRED` 拒绝。订单文字和未来 Vision 共享同一 durable reserve 网关，因此事故窗口内付费路径统一失败关闭；失败窗口没有 OpenAI 调用或新增费用。前向迁移 `20260720065246_ai_usage_bucket_store_fence_hotfix.sql` 已应用到生产：它以表专用触发器恢复全局桶，并用同一 per-store advisory lock 阻止在 provider reservation 未结算时关闭门店。迁移通过目录、ACL、RLS 和聚合后检；随后唯一一次无 PII 订单文字 canary 以 HTTP 200、单次 provider attempt、账本/审计成功和 `130 micro-USD` 结算，15 分钟 16 次轮询保持 0 open、0 bad、0 cross-store、0 reserved、0 overrun 和 0 Vercel runtime error。发布与验证边界以 `docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md` 的事故章节为准。

实现使用 Node 原生 server-side `fetch`，没有新增 OpenAI SDK 依赖。Platform Key 与 HMAC secrets 未写入代码、任务记忆、日志、测试夹具或截图。本次 Vision 候选没有执行真实 provider 请求；尚未把任何真实图片、OCR、客户资料或设备标识符发送给第三方。

2026-07-19 的 Vision 发布候选在最新 `ai-runtime-v2` 基线上新增 server-side Sharp 信任边界、稳定 client UUID、净化图片 + 精确模型请求指纹、Chinatech-only 图片外发、读大请求体前 capability/短窗限流、provider 配置错误失败关闭与云端标识符重校验。它已通过合成图片与 mocked cloud 验证，但仍是本地候选；生产当前状态以 `docs/AI_ASSISTANT_LIVE_PILOT_RUNBOOK.md` 为准。Vision D4 建议复用已批准的 `$50/月` v2 共享政策，照片外发仍需独立批准，详见 `docs/AI_ASSISTANT_VISION_PILOT_RUNBOOK.md`。

2026-07-24 的多店铺应用候选把订单助手拆成两个门店发布面：所有店铺可通过独立全店铺开关获得本地只读查询；外部文字模型仍要求精确 provider allowlist。未获 provider 权限的门店在进入预算预留和供应商构造前就返回本地澄清，因此不会产生外发或模型费用。Vision、草稿应用、行内写入和公开助手没有随本地只读能力扩大。当前预算合同只有每店每日次数、全局每日次数和共享全局月度 micro-USD 上限，没有每店独立月预算。

## 请求顺序

```text
认证 / capability / 现有业务权限
→ 所有请求的短窗防滥用限流
→ 确定性或本地路径
   ├─ 精确订单号或锁定快捷短语：直接访问 actor/store-scoped repository
   ├─ 完整本地标签候选：进入人工复核，不生成 data URL，不请求云端
   └─ 不能保守判断：才进入 provider fallback 候选
→ 图片 fallback 在服务端完整解码单帧、限制像素/边长并重编码无元数据 JPEG
→ durable provider 预算预留（live 前必需）
→ 单次、有限时 provider 调用
→ usage 结算 / 未知状态保守持有
→ allowlist 聚合审计
```

“短窗防滥用限流”与“付费 provider 额度”是两个独立控制：零模型路径不扣付费额度，但仍受 actor/store 每分钟请求限制，防止放大数据库查询。

## 处理方式选择与门店使用量（本地候选）

`TASK-20260719-004-ai-processing-mode-usage` 在工单 AI 输入区增加显式处理方式，默认选择“本地处理”：

- `processing_mode=local` 只执行版本化确定性规则和当前门店 RepairDesk 查询；不能保守识别时返回澄清，不会静默升级到 provider，也不预留大模型预算。
- `processing_mode=model` 跳过确定性捷径，强制进入既有 provider、外发批准、敏感数据检查、actor 限流、门店/全局预算和聚合审计链路；选择大模型不等于绕过任何 live 门禁。
- 旧客户端省略 `processing_mode` 时继续使用既有“确定性优先、必要时 provider”行为，避免破坏兼容性。
- 客户端不能选择模型、价格、额度、Safety ID 或门店；模式只控制是否允许进入既有受控 provider 路径。
- 明确设备原句在 model 模式下也会经过服务端语义守卫：provider 仍只调用/预留/结算一次，但其空、数字化或冲突设备计划会被原句中受控的品牌+型号约束校正；仓储返回值若违反有效设备约束则整体失败关闭，不把错误卡片或错误总数展示给员工。

设置中心提供只读“AI 使用量”，AI 对话面板同时显示今日 `order_text` 请求/额度、总 Token 和已结算美元估算。两处复用同一个门店 query key 与聚合接口；大模型提交成功后刷新当前门店缓存，用量读取失败不阻断查询。只有 `finance:aggregate_read` 成员会发起用量请求或看到摘要。对话内用量和处理方式详情默认收起，当前模式及大模型外发/计费含义仍常显。

`GET /api/repairdesk/ai/usage` 不接收门店参数，要求 `finance:aggregate_read`，并从认证 actor 的当前 `storeId` 读取 `ai_assistant_usage_buckets` 的 `store_day` 聚合。响应只包含今天和最近 30 天的大模型请求数、输入/缓存/输出 Token、已结算及预留 micro-USD、今日分类额度和生成时间；不返回 prompt、回复、订单号、客户资料、actor 或请求指纹。本地处理不调用大模型，因此不计入该视图。

该用量视图复用 RepairDesk 的预算结算事实，不调用 OpenAI 组织级 Usage/Costs API，也不需要新增管理员密钥、表或 migration。金额是当前 RepairDesk 价格策略下的美元估算，不是供应商最终账单。模式选择与用量 API/UI 已随 `TASK-20260719-004` 发布；默认折叠和设备语义守卫属于 `TASK-20260719-005` 的应用代码候选，不修改生产配置、模型、密钥、预算或数据库。

## 零模型订单路由

权威实现：`src/features/ai-assistant/server/order-intent-router.ts`。

只直接处理：

- 完整 `R` 工单号、严格 `RD-` 编号或完整 UUID；
- 当前 UI 的三个完整快捷短语，以及版本化的完整英语/意大利语对应短语。

客户姓名、电话、IMEI、纯数字、部分工单号、组合条件和含糊表达全部返回 `null`，继续走既有 provider planner。权限检查和通用请求限流始终先执行；直接命中仍通过原有 repository 的 actor/store 边界。

## 本地优先图片识别

权威实现：`inventory-recognition.ts` 与 `inventory-intake-dialog.tsx`。

图片先完成既有浏览器安全处理和本地 BarcodeDetector/ZXing/TextDetector。只有品牌、型号、RAM、存储四个关键标签字段全部存在、无冲突且无无效标识符证据时，才认为本地候选足够；此时不创建 Base64 data URL，也不调用 `/ai/vision/extract`。需要 cloud fallback 时，服务端把浏览器衍生图再次视为不可信输入：完整解码静态单帧、限制 16 MP、应用方向、铺白、最长边压至 2048、重新编码 JPEG 并默认丢弃 EXIF/ICC/XMP。预算指纹绑定这份服务端衍生图与精确模型，provider 只接收该衍生图。结果仍只是待人工复核的包装标签声明，员工不点击普通 `保存商品` 就不会产生库存写入。

不支持 TextDetector 的浏览器通常仍会进入 fallback 候选；“本地识别率 70%”只是需要真实门店清晰标签集校准的目标，当前不能作为生产承诺。

## 版本化模型与成本

权威实现：`runtime-policy.ts` 与 `cost-policy.ts`。

| 场景               | 精确候选模型             |  最大输入估算 | 最大输出 | 已实施 Provider deadline | Paid pilot 端到端观测目标 | 自动尝试 |
| ------------------ | ------------------------ | ------------: | -------: | -----------------------: | ------------------------: | -------: |
| `order_text`       | `gpt-5-nano-2025-08-07`  |  4,096 tokens |      256 |                       8s |                      ≤12s |        1 |
| `inventory_vision` | `gpt-4o-mini-2024-07-18` | 50,000 tokens |    1,024 |                      25s |                      ≤30s |        1 |

12/30 秒目前只是 paid pilot 的观测目标，不是已实施的端到端取消控制。路由取消信号已传到真实 provider，并强制 8/25 秒 provider deadline；取消与超时返回不同稳定错误。现有订单 repository 接口尚未接收 `AbortSignal`，因此不能把数据库阶段误称为可取消。

`gpt-5-mini-2025-08-07` 只保留为未来受控候选；Phase 3A 自动 fallback 为 0。模型 snapshot、runtime policy 和价格快照共同版本化，防止 alias 或价格变化悄悄改变预算。

成本统一使用整数 micro-USD：`$1 = 1,000,000 micro-USD`，因此提案 `$50 = 50,000,000 micro-USD`。输入分为未缓存、cached 和 cache-write，再加 output；每个非空计费类别独立向上取整。负数、非安全整数、缓存分类大于输入、未知模型或溢出全部失败关闭。reasoning tokens 已包含于 output，不重复计费。

价格快照来源于 [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)；缓存边界参见 [Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)。该快照用于估算和硬停，不能冒充供应商最终发票、税费或欧元换算。

## Safety Identifier 与取消

- `safety-identifier.ts` 使用独立 server-only secret 对稳定 actor ID 做 HMAC-SHA256，输出 `u1_` 前缀的 base64url 值；不发送邮箱、姓名、店名、电话或原始 actor/store ID。
- 缺少至少 32 字符的独立 secret 时 live 配置失败；Safety ID 不进入响应、数据库或普通日志，审计只记 `has_safety_identifier` 布尔值。
- `provider-signal.ts` 合并浏览器/路由取消和固定 provider deadline；provider interface 已接收 `AbortSignal`。
- 请求一旦可能已发送，超时或断线不能按 0 退款；必须按预留上限结算或进入对账持有。

## 订单续页与计费边界

- Order Query V4 首轮只在员工明确选择大模型且没有安全本地直达时预留并结算一次 provider 请求。结果续页不会重新规划，也不会创建新的 provider reservation。
- 服务端使用既有 `AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET` 对受验证查询计划、10 分钟期限和 actor/store HMAC 作用域执行 AES-GCM 加密密封与 HMAC 签名；浏览器无法读取查询词，原始 actor/store ID、订单结果和模型证据引用不会进入令牌，经过验证的查询计划只存在于认证密文中。秘密轮换会让旧令牌立即失效。
- 续页仍计入应用短窗请求限流并重新执行认证、RBAC、门店隔离和 repository 查询；它不增加 `provider_request_count`、Token 或 micro-USD。若 secret 缺失、令牌过期、篡改或作用域改变，续页失败关闭，不回退为重新调用模型。

## Durable quota migration 链

已经应用且不得改写的 Phase 3A 基线：
`supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql`。

已经应用且不得改写的 additive upgrade：
`supabase/migrations/20260718223739_ai_assistant_live_provider_v1.sql`。

已经应用且不得改写的前向兼容修复：
`supabase/migrations/20260720065246_ai_usage_bucket_store_fence_hotfix.sql`。它不改变 policy、pricing、额度、模型、RLS 或客户端 grants；只替换混合桶表的 writer fence，并把未结算 AI reservation 纳入 lifecycle active→非 active 的事务门禁。

基线创建 policy、aggregate bucket、request ledger 与四个 dormant RPC；upgrade 在确认三张治理表仍为空后，新增 actor 短窗桶、请求关联列、policy attestation、维护 RPC，以及带 actor HMAC 的 reserve 签名。两条迁移都不插入 policy，也不会自动启用付费调用。

新增对象仅包含成本治理，不保存业务正文：

- `ai_assistant_usage_policies`：不可变版本、门店时区、模型/价格、Token 上限、次数和 micro-USD 上限；迁移不插入任何 enabled policy。
- `ai_assistant_usage_buckets`：门店日、全局日和全局月原子聚合桶。
- `ai_assistant_actor_rate_buckets`：按门店和 keyed-HMAC actor 指纹记录短窗计数，不保存原始 actor ID。
- `ai_assistant_usage_requests`：随机请求 ID、keyed-HMAC 请求指纹、模型/版本、预留/估算费用、Token 与状态；不保存 actor、正文、图片、OCR、订单或标识符。
- 六个 service-role-only RPC：政策一致性证明、预留、按 usage 结算、可证明未发送时释放、过期保守结算、分批维护。

桶身份不包含 `policy_version`：同一门店日/全局日/月在策略版本切换后继续使用原累计，不能通过创建新策略重置硬预算。历史策略存在后，直接改变 quota timezone 会失败关闭；同一开放周期的新策略上限按 `least(旧上限, 新上限)` 只允许收紧，中途提高额度要等下一周期。只有可以证明 Provider 尚未发送的 `release_pre_dispatch` 才同时退还预留金额和 Provider 请求次数；未知是否已发送的请求保持预留并最终按上限保守结算。

日桶按策略中的 IANA 门店时区计算，时间戳仍为 UTC；因此 Europe/Rome 夏令时的 23/25 小时营业日不会被固定 UTC 日界线错误描述为“今日”。数据库时间来自 `clock_timestamp()`，不接受客户端时间。

每次真实预留前，应用都会先处理少量过期预留，再调用 `repairdesk_attest_ai_usage_policy` 比较部署环境与数据库政策的模型、价格、Token、额度、时区、最大预留、尝试次数和 TTL。任何差异都在 provider dispatch 前失败关闭。

所有表启用 RLS，不给 `anon` / `authenticated` policy，显式撤销表和 RPC 权限，再只授予 `service_role` 所需权限。Grants 与 RLS 是两个独立控制，参见 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) 与 [Data API Grants 变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)。

迁移包含默认无副作用的维护 RPC：先把超过 TTL 的 `reserved` 请求按预留上限保守结算，再分批删除早于批准保留截止日的已结算请求明细和不再被引用的 actor 短窗桶；绝不删除仍为 `reserved` 的行。应用提供受 `CRON_SECRET` 保护的每日维护路由，同时每次预留前也会小批量处理 stale 行。生产仍须 D4 批准保留天数；当前建议 90 天。月度聚合桶不由该维护任务删除，期限按财务/税务要求另定。

## 环境门禁

以下 live 配置必须全部存在、有效且版本匹配，任何缺项均保持 `AI_MISCONFIGURED`：

```dotenv
AI_ORDER_ASSISTANT_ALL_STORES_ENABLED=0
AI_ORDER_ASSISTANT_STORE_DENYLIST=
AI_ORDER_PROVIDER_STORE_ALLOWLIST=
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=0
AI_ASSISTANT_DURABLE_QUOTA_BACKEND=
AI_ASSISTANT_POLICY_VERSION=
AI_ASSISTANT_PRICING_VERSION=
AI_ASSISTANT_MONTHLY_BUDGET_MICRO_USD=0
AI_ASSISTANT_ORDER_TEXT_PER_STORE_DAY=0
AI_ASSISTANT_INVENTORY_VISION_PER_STORE_DAY=0
AI_ASSISTANT_PROVIDER_REQUESTS_GLOBAL_DAY=0
AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE=30
AI_ASSISTANT_QUOTA_TIMEZONE=
AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET=
AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET=
AI_ASSISTANT_MAINTENANCE_ENABLED=0
AI_ASSISTANT_USAGE_RETENTION_DAYS=0
CRON_SECRET=
OPENAI_AI_ASSISTANT_ORDER_MODEL=
OPENAI_AI_ASSISTANT_VISION_MODEL=
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
```

`AI_ASSISTANT_REQUESTS_PER_STORE_DAY` 仍只是 dormant/fake 单进程 provider 配额兼容项，不能作为多实例硬预算。生产 secret 不得写入 `.env.example`、Git、任务文件、日志或截图。

## 数值提案与批准边界

订单文字 D4-v2 已批准每店每天 `20 order_text + 10 inventory_vision`、全局 300 次、每 actor 每分钟 30 次、每月 `$50` 的共享政策数值，但其数据范围明确保持 Vision off。Vision 候选复用这些数值以避免不可变 policy 漂移；这不构成照片外发批准。ChatGPT/Codex Plus/Pro 订阅不抵扣 OpenAI Platform API 用量；Vision 仍需 Owner 明确确认同一月度硬停与图片数据边界。

## 验证与回滚

两条既有治理迁移与围栏修复按真实顺序在无持久卷的 PostgreSQL 17 临时容器执行，修复迁移又连续重放一次；验证了创建、政策一致性证明、RLS/Grants、相同 client request 幂等、订单与视觉结算、pre-dispatch 金额/次数释放、actor 分钟限流、stale 保守结算、活动预留保留、匿名角色拒绝、全局桶 identity 防篡改和 closing-store 零半写。两个独立数据库会话分别证明 reserve-first 时 close 回滚，以及 close-first 时 reserve 整笔回滚。仓库完整历史迁移的 `supabase db start` 仍可能受早期基线漂移影响；本任务使用的是精确最小 schema + 当前三条 AI/lifecycle 迁移行为链，不能把它冒充完整历史可重放证明。

远端 migration history 已包含 `20260718174042`、三条 Inventory V2 migration、`20260718223739`、store-lifecycle migration `20260720013000` 和围栏修复 `20260720065246`；不得重放或修改这些历史文件。热修复后的 linked dry-run 返回远端已是最新。Vision D4 应复用并精确证明既有 `ai-runtime-v2`，不得重建或改写同版本 policy；只有模型、价格、预算或额度发生变化时才允许另开 D4 并创建新的版本化 policy。任何 Vision 写入前仍须核对 v1 已停用、请求账本无开放 reservation、Vision 计数为 0 且远端没有并发 migration drift。

回滚顺序：关闭 paid fallback → 保留 direct/local/manual → 设置 `AI_ASSISTANT_ENABLED=0` → 必要时回退应用 exact SHA。即使未来迁移已经应用，也不紧急 DROP 用量表；先停止新预留并保守结算已有请求。
