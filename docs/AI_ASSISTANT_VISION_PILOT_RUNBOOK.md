# Chinatech AI 图片标签识别单店发布手册

Status: Vision D4 approved; serialized Production release in progress
Task: `TASK-20260719-001-ai-inventory-live-provider`
Last verified: 2026-07-19 CEST

## 当前结论

现有 OpenAI Platform Key 已存在；页面显示“当前门店尚未开放图片识别”不是缺少密钥，而是生产的图片外发批准与 Vision 功能旗标仍按设计关闭。订单文字的 D4-v2 已独立批准并由 `TASK-20260718-014-ai-assistant-live-pilot` 串行发布，但其批准文本明确排除 Vision。不得把订单文字批准解释成照片外发批准，也不得通过重新创建或复制 Key 绕过门禁。

本候选已把库存标签识别接到既有原生 `fetch` Responses provider，并保留手工入库：浏览器先解码、去元数据和重编码；服务端再次完整解码单帧、限制像素/边长、旋转、铺白并生成无元数据 JPEG。只有服务端衍生图可以参与请求指纹、预算预留和 OpenAI 调用。识别结果只能成为员工逐字段确认的未保存草稿，成本、售价、来源、IMEI/SN 与正式保存不由云端 AI 完成。

截至本手册时间，本 Vision 任务只执行了 fake provider、mocked cloud 和合成图片测试，没有发送真实图片、客户资料或设备标识符，也没有产生 Vision 计费请求或修改生产环境。订单文字任务已经消费其独立授权的 v2 smoke；该调用不扩大本任务权限。

## 已批准的发布包

Owner 于 2026-07-19 明确批准 Vision 第一轮复用订单文字 D4-v2 的同一套合并硬预算，并单独批准下列照片范围：

| 项目                |                                              建议值 |
| ------------------- | --------------------------------------------------: |
| 唯一门店            |    Chinatech `5248dda1-2b32-46cd-8ed0-d15386a9e8ed` |
| OpenAI API 月度硬停 |                   `$50.00` = `50,000,000 micro-USD` |
| 订单文字            |                                    每店每天 `20` 次 |
| 库存图片            |                                    每店每天 `10` 次 |
| Provider 全局       |                                       每天 `300` 次 |
| 单员工短窗          |                                      每分钟 `30` 次 |
| 额度时区            |                                       `Europe/Rome` |
| 订单模型            | `gpt-5-nano-2025-08-07`，`reasoning.effort=minimal` |
| 图片模型            |             `gpt-4o-mini-2024-07-18`，`detail=high` |
| 自动尝试            |                            `1`；无自动模型 fallback |

按当前最坏预留值，Chinatech 每天用满 20 次文字与 10 次图片约预留 `$0.08731`，30 天约 `$2.6193`。因此单店阶段主要由每日次数限额约束，`$50` 是现有共享政策的最终全局硬停，不是消费目标。实际 usage 通常低于预留，但不能用预估代替硬预算；任何预算变更都必须创建新的版本化 policy 和新的 D4。

### 图片数据边界

允许：员工主动拍摄或选择、只包含包装标签上品牌、型号、颜色、RAM 与存储容量的紧裁切区域。

禁止：人物或人脸、证件、客户姓名/电话/邮箱、收据或地址、设备屏幕内容、支付资料、维修单、IMEI、SN、EAN/条码以及任何无关背景。IMEI/SN/EAN 只走本地扫描或手工录入；首版云端响应 Schema 强制 `identifiers=[]`。

客户端与服务端都会重编码和去元数据，应用不保存原图，provider 请求使用 `store:false`。这不等于 Zero Data Retention；默认安全监控可能保留输入/输出最多约 30 天。Owner 仍需确认该边界以及适用的 DPA、法律基础、员工告知、数据区域/跨境与删除流程。

## Owner D4 批准记录

Owner 已回复等价批准，生产只能按以下冻结边界执行：

> 批准 Vision D4：仅 Chinatech；复用 ai-runtime-v2 已批准的 OpenAI API 合并硬预算 50 美元/月、订单文字 20 次/日、库存图片 10 次/日、全局 300 次/日、每员工 30 次/分钟；只允许外发裁剪后的包装规格标签，禁止人物、证件、客户资料、收据/地址、设备屏幕和 IMEI/SN/EAN；允许 1 次合成无 PII 的图片计费 smoke；通过后只开启 Chinatech 图片识别和人工草稿应用，保留既有订单文字 AI，观察 30 分钟并在 24 小时复核；允许使用测试账号在 `www.chinatech.in` 完成手机和电脑端验收。禁止自动库存写入、客户公开 AI、第二门店和自动重试。

不同预算、额度、门店、图片范围、模型、smoke 次数或功能范围都属于新的 D4，不得自行补全。

## 获批后的精确环境合同

共享 v2 policy 数字保持不变，不创建 `$3` 或其他冲突 policy：

```dotenv
AI_ASSISTANT_PROVIDER=openai
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_ORDER_EXTERNAL_DATA_APPROVED=1
AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=1
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

Vision smoke 前，生产仍保持 `AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0`、`AI_VISION_INTAKE_ENABLED=0`、`AI_DRAFT_APPLY_ENABLED=0`；订单文字任务拥有的 master/order/maintenance/allowlist 状态不得由本任务回退或覆盖。Vision smoke 通过后，只把前三项分别切为 `1`，并再次证明 allowlist 只有 Chinatech、`AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=0`。

Production secrets 只允许从平台 secret store 注入：`OPENAI_API_KEY`、`AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET`、`AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET`、`CRON_SECRET`。它们必须各自独立；API Key 也不得与任一 HMAC secret 相同。不得放入 Git、任务记忆、日志、截图、浏览器 Bundle 或 `NEXT_PUBLIC_*`。

## 发布顺序

1. 记录独立 Vision D4；等待订单文字 `TASK-20260718-014` 释放生产写锁并完成/停止其观察，不并发修改 Supabase、Vercel、`main` 或正式域名。
2. 刷新 `origin/main`、生产部署、v2 policy、开放 reservation、Vercel flags 和 Chinatech allowlist；要求 v2 精确 attestation 通过、Vision 请求数仍为 0。不得改写已应用 migration 或重建 policy。
3. 将本候选重放到最新 `main`，重跑质量门后推送 exact reviewed SHA；部署时维持 Vision 外发、Vision intake 与 draft apply 三项为 `0`，保留订单文字现状。
4. 通过正式服务路径执行一次且仅一次合成无 PII、无标识符、紧裁切包装规格图片 smoke。禁止直连 provider、真实客户数据或自动重试。
5. smoke 必须同时满足 HTTP 200、严格 Schema、`identifiers=[]`、provider attempt `1`、ledger `succeeded`、usage 已结算、audit `succeeded`、无敏感日志；任一失败保持 Vision flags off 并结束 Vision 发布，不影响已验证的订单文字功能。
6. smoke 通过后，allowlist 仍只能是 Chinatech UUID；只启用 `AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=1`、`AI_VISION_INTAKE_ENABLED=1`、`AI_DRAFT_APPLY_ENABLED=1`。Public AI 与其他门店保持关闭。
7. 正式域名验证桌面和手机：本地足够时零云调用；本地不足时一次云调用；结果逐字段确认；应用后仍未保存；价格/成本/来源/标识符未被云端填入；取消、离线、超时和额度耗尽均保留手工入库。
8. 观察 30 分钟，核对请求数、错误/取消、预留/结算/hold、Token、micro-USD、延迟桶、审计可用性与零自动库存写入。24 小时复核后只决定保留或关闭；第二店或扩大范围需新 D4。

## 立即停止与回滚

出现跨店/越权、禁止图片内容外发、日志出现图片/正文/secret、未预留 dispatch、政策 attestation 不一致、重复 provider 尝试、未收敛 hold、预算越界、严格 Schema 失败或手工入库不可用时，立即：

1. `AI_VISION_INTAKE_ENABLED=0`、`AI_DRAFT_APPLY_ENABLED=0`、`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0` 并重新部署；
2. 保守结算已有 Vision reservation，不删除账本；
3. 必要时回滚 Web exact SHA，但保留既有 v2 policy 与已验证订单文字功能；
4. 只有共享 provider/预算/权限边界失守时才关闭 `AI_ASSISTANT_ENABLED` 或停用 v2 policy；
5. 怀疑 secret 暴露时轮换对应 secret，再更新平台并重新部署。

不得用 DROP/DELETE 清理治理账本，也不得用重新创建 Key 代替根因调查。
