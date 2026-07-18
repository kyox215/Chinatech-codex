# RepairDesk AI 小助手成本治理与运行合同

Status: implemented as dormant Phase 3A code; paid pilot blocked
Owner: Integration Lead / Architecture / DATA / Security
Last verified: 2026-07-18 CEST, `TASK-20260718-011-ai-assistant-cost-governance`

## 当前结论

Phase 3A 先让可确定完成的任务不进入模型，再为确实需要 provider 的请求建立版本化成本和原子预留合同。当前生产仍必须保持全部 AI 旗标关闭、provider 为 `fake` 或缺省；OpenAI provider 仍故意返回 `AI_MISCONFIGURED`，迁移文件也未应用。

本阶段没有改变公开请求/响应 schema，没有安装 OpenAI SDK，没有读取或同步 API Key，也没有把真实消息、图片、OCR、订单号或标识符发送给第三方。

## 请求顺序

```text
认证 / capability / 现有业务权限
→ 所有请求的短窗防滥用限流
→ 确定性或本地路径
   ├─ 精确订单号或锁定快捷短语：直接访问 actor/store-scoped repository
   ├─ 完整本地标签候选：进入人工复核，不生成 data URL，不请求云端
   └─ 不能保守判断：才进入 provider fallback 候选
→ durable provider 预算预留（live 前必需）
→ 单次、有限时 provider 调用
→ usage 结算 / 未知状态保守持有
→ allowlist 聚合审计
```

“短窗防滥用限流”与“付费 provider 额度”是两个独立控制：零模型路径不扣付费额度，但仍受 actor/store 每分钟请求限制，防止放大数据库查询。

## 零模型订单路由

权威实现：`src/features/ai-assistant/server/order-intent-router.ts`。

只直接处理：

- 完整 `R` 工单号、严格 `RD-` 编号或完整 UUID；
- 当前 UI 的三个完整快捷短语，以及版本化的完整英语/意大利语对应短语。

客户姓名、电话、IMEI、纯数字、部分工单号、组合条件和含糊表达全部返回 `null`，继续走既有 provider planner。权限检查和通用请求限流始终先执行；直接命中仍通过原有 repository 的 actor/store 边界。

## 本地优先图片识别

权威实现：`inventory-recognition.ts` 与 `inventory-intake-dialog.tsx`。

图片先完成既有安全处理和本地 BarcodeDetector/ZXing/TextDetector。只有品牌、型号、RAM、存储四个关键标签字段全部存在、无冲突且无无效标识符证据时，才认为本地候选足够；此时不创建 Base64 data URL，也不调用 `/ai/vision/extract`。结果仍只是待人工复核的包装标签声明，员工不点击普通 `保存商品` 就不会产生库存写入。

不支持 TextDetector 的浏览器通常仍会进入 fallback 候选；“本地识别率 70%”只是需要真实门店清晰标签集校准的目标，当前不能作为生产承诺。

## 版本化模型与成本

权威实现：`runtime-policy.ts` 与 `cost-policy.ts`。

| 场景               | 精确候选模型             |  最大输入估算 | 最大输出 | 已实施 Provider deadline | Paid pilot 端到端观测目标 | 自动尝试 |
| ------------------ | ------------------------ | ------------: | -------: | -----------------------: | ------------------------: | -------: |
| `order_text`       | `gpt-5-nano-2025-08-07`  |  4,096 tokens |      256 |                       8s |                      ≤12s |        1 |
| `inventory_vision` | `gpt-4o-mini-2024-07-18` | 50,000 tokens |    1,024 |                      25s |                      ≤30s |        1 |

12/30 秒目前只是 paid pilot 的观测目标，不是已实施的端到端取消控制。Phase 3A 已把路由取消信号传到 provider，并强制 8/25 秒 provider deadline；现有订单 repository 接口尚未接收 `AbortSignal`，因此不能把数据库阶段误称为可取消。未来只有在 repository 支持信号并完成回归后，才能把端到端目标升级为硬 deadline。

`gpt-5-mini-2025-08-07` 只保留为未来受控候选；Phase 3A 自动 fallback 为 0。模型 snapshot、runtime policy 和价格快照共同版本化，防止 alias 或价格变化悄悄改变预算。

成本统一使用整数 micro-USD：`$1 = 1,000,000 micro-USD`，因此提案 `$50 = 50,000,000 micro-USD`。输入分为未缓存、cached 和 cache-write，再加 output；每个非空计费类别独立向上取整。负数、非安全整数、缓存分类大于输入、未知模型或溢出全部失败关闭。reasoning tokens 已包含于 output，不重复计费。

价格快照来源于 [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)；缓存边界参见 [Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)。该快照用于估算和硬停，不能冒充供应商最终发票、税费或欧元换算。

## Safety Identifier 与取消

- `safety-identifier.ts` 使用独立 server-only secret 对稳定 actor ID 做 HMAC-SHA256，输出 `u1_` 前缀的 base64url 值；不发送邮箱、姓名、店名、电话或原始 actor/store ID。
- 缺少至少 32 字符的独立 secret 时 live 配置失败；Safety ID 不进入响应、数据库或普通日志，审计只记 `has_safety_identifier` 布尔值。
- `provider-signal.ts` 合并浏览器/路由取消和固定 provider deadline；provider interface 已接收 `AbortSignal`。
- 请求一旦可能已发送，超时或断线不能按 0 退款；必须按预留上限结算或进入对账持有。

## Durable quota migration 草案

文件：`supabase/migrations/20260718174042_ai_assistant_cost_governance_v1.sql`。

新增对象仅包含聚合成本治理：

- `ai_assistant_usage_policies`：不可变版本、门店时区、模型/价格、Token 上限、次数和 micro-USD 上限；迁移不插入任何 enabled policy。
- `ai_assistant_usage_buckets`：门店日、全局日和全局月原子聚合桶。
- `ai_assistant_usage_requests`：随机请求 ID、keyed-HMAC 指纹、模型/版本、预留/估算费用、Token 与状态；不保存 actor、正文、图片、OCR、订单或标识符。
- `reserve → finalize / release_pre_dispatch / settle_stale` 四个 service-role-only RPC。

桶身份不包含 `policy_version`：同一门店日/全局日/月在策略版本切换后继续使用原累计，不能通过创建新策略重置硬预算。历史策略存在后，直接改变 quota timezone 会失败关闭；同一开放周期的新策略上限按 `least(旧上限, 新上限)` 只允许收紧，中途提高额度要等下一周期。只有可以证明 Provider 尚未发送的 `release_pre_dispatch` 才同时退还预留金额和 Provider 请求次数；未知是否已发送的请求保持预留并最终按上限保守结算。

日桶按策略中的 IANA 门店时区计算，时间戳仍为 UTC；因此 Europe/Rome 夏令时的 23/25 小时营业日不会被固定 UTC 日界线错误描述为“今日”。数据库时间来自 `clock_timestamp()`，不接受客户端时间。

所有表启用 RLS，不给 `anon` / `authenticated` policy，显式撤销表和 RPC 权限，再只授予 `service_role` 所需权限。Grants 与 RLS 是两个独立控制，参见 [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) 与 [Data API Grants 变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)。

迁移只建立账本，不自动删除证据。Paid pilot 前仍需 D4 批准正式保留政策；当前建议仅对已结算请求明细保留 90 天、分批清理且绝不删除 `reserved`/待对账行，月度聚合桶按财务/税务要求另定期限。清理 RPC/调度必须作为独立 additive migration 经过恢复、审计和生产 apply 门禁；本阶段不能把建议期限误称为已实施删除。

## 环境门禁

以下 live 配置必须全部存在、有效且版本匹配，任何缺项均保持 `AI_MISCONFIGURED`：

```dotenv
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=0
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
```

`AI_ASSISTANT_REQUESTS_PER_STORE_DAY` 仍只是 dormant/fake 单进程 provider 配额兼容项，不能作为多实例硬预算。生产 secret 不得写入 `.env.example`、Git、任务文件、日志或截图。

## 数值提案与批准边界

当前仅建议：每店每天 `20 order_text + 10 inventory_vision` provider fallback、全局每天 300 次、API 净用量每月 `$50`。这些数字可以用于合成测试和批准包，但没有 enabled policy，也不得写入生产环境，直至 Owner 明确批准预算、时区、门店 cohort、真实数据外发、SDK/依赖、迁移 apply 和 live flags。

## 验证与回滚

迁移最终版本已在无持久卷的 PostgreSQL 17 临时容器执行；验证了默认 enabled policy 为 0、RLS/Grants、幂等预留、并发最后额度、结算、pre-dispatch 金额/次数释放、策略版本切换不重置当期月预算、stale 保守结算与 overrun 自动停用。仓库完整历史迁移的 `supabase db start` 仍会被早期 `product_channel` 基线漂移阻塞；该失败不等于本迁移通过生产 apply 门禁。

回滚顺序：关闭 paid fallback → 保留 direct/local/manual → 设置 `AI_ASSISTANT_ENABLED=0` → 必要时回退应用 exact SHA。即使未来迁移已经应用，也不紧急 DROP 用量表；先停止新预留并保守结算已有请求。
