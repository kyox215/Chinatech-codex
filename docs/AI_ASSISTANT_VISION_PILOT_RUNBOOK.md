# Chinatech AI 图片标签识别单店发布手册

Status: ChinaTech Vision live; local one-photo IMEI extension deployed, authenticated Chinatech smoke pending
Task: `TASK-20260719-001-ai-inventory-live-provider`
Related extension: `TASK-20260719-008-inventory-imei-one-capture`
Last verified: 2026-07-19 CEST

## 当前结论

现有 OpenAI Platform Key 一直有效；先前页面显示“当前门店尚未开放图片识别”不是缺少密钥，而是生产图片外发与 Vision 功能旗标按设计关闭。Owner 后续已单独批准 Vision D4，本任务按休眠部署、零基线和 Chinatech-only 三门顺序开放，没有重新创建或复制 Key。

现有正式功能已把库存标签识别接到既有原生 `fetch` Responses provider，并保留手工入库：浏览器先解码、去元数据和重编码；服务端再次完整解码单帧、限制像素/边长、旋转、铺白并生成无元数据 JPEG。只有服务端衍生图可以参与请求指纹、预算预留和 OpenAI 调用。识别结果只能成为员工逐字段确认的未保存草稿，成本、售价、来源、IMEI/SN 与正式保存不由云端 AI 完成。

首次手机端尝试曾被前端生命周期清理自取消，界面持续停留在处理中，但请求没有到达 BFF、Supabase reservation 或 OpenAI。`main@50f843dd` 已通过 ref/run-id 生命周期、8 秒 FileReader 和 75 秒全链路 watchdog 修复该根因，并从可选图片路径移除不可抢占的主线程 ZXing 回退。

`main@facb79b984de5ffdc596210cd9ba33883343053e` 已部署本次 one-photo 扩展。员工可在 Inventory V2 第 2 步拍一张完整包装标签：浏览器先用原生 Detector，缺失时再用可终止的同源 ZXing Worker 与固定版本同源 Tesseract Worker 读取规格、IMEI、SN 和 EAN。完整照片、完整条码和原始 OCR 文本只存在于浏览器临时内存，不会被序列化、排队或发送。IMEI 默认遮罩显示，通过 Luhn 校验后才可选；同图同时存在 EAN 与 IMEI 时默认以 IMEI 为主标识。任何候选都仍需员工确认，并且只合并进未保存草稿，不覆盖已手工填写的内容。

只有本地规格不完整时才显示第二条路径：员工必须调整规格裁剪、生成独立去元数据预览，并勾选确认预览不含 IMEI、SN、EAN、人物或 PII，应用才会把该裁剪发送给既有 Vision BFF。完整标签 Blob 没有进入该请求路径；离线时本地候选会保留且不会排队上传。该扩展不改变 Supabase schema、预算、provider、模型、门店 allowlist 或每日图片额度。

发布证据：正式部署 `dpl_3HZsEL9XraLy1McLeaTxHCwsxpKs` 为 `READY`；五项同源 OCR 资产均 HTTP 200，英语模型哈希与锁定来源一致；Supabase 91/91 对齐且本次 `db push` 为 up-to-date no-op；发布窗口 Vision reservation 与库存 intake 写入均为零。现有获授权测试账号只属于 `xutech`，生产页正确阻止其进入 Chinatech-only V2，但正式 Chinatech 登录态手机/电脑 smoke 尚未执行。后续必须使用有 Chinatech membership 的账号；不得为补证据扩大 allowlist 或冒充门店。

2026-07-19 的正式 smoke 只发送一张事先目检的合成规格标签，返回 `NOVA / A7 PRO / BLUE / 8 GB / 256 GB`。账本与审计各精确增加 `1`，唯一 provider attempt 成功并按 usage 结算 `5713` micro-USD；open/bad/cross-store 为 `0`，库存基线与事后均为 `4`。没有发送真实图片、客户资料、条码或设备标识符，也没有自动保存库存。30 分钟观察从 reservation `2026-07-19T13:11:21.021029Z` 持续到最终聚合 `2026-07-19T13:42:19.925504Z`，请求/attempt/audit 保持 `1/1/1`，运行错误、未结算、失败、跨店与库存写入均为 `0`，正式域名保持 READY。24 小时仍需只读复核。

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

本地允许：员工主动拍摄或选择完整包装标签，用于浏览器内读取品牌、型号、颜色、RAM、存储容量、IMEI、SN 与 EAN。完整标签只能停留在浏览器临时内存；关闭、删除、重新选图、超时或离开步骤时必须终止 Worker 并释放对象 URL。

云端允许：员工主动调整、预览并明确确认、只包含包装标签上品牌、型号、颜色、RAM 与存储容量的紧裁切区域。

禁止：人物或人脸、证件、客户姓名/电话/邮箱、收据或地址、设备屏幕内容、支付资料、维修单、IMEI、SN、EAN/条码以及任何无关背景。IMEI/SN/EAN 只走本地扫描或手工录入；首版云端响应 Schema 强制 `identifiers=[]`。

客户端与服务端都会重编码和去元数据，应用不保存原图，provider 请求使用 `store:false`。首版请求与响应结构不携带标识符字段，但软件不能自动证明员工所选像素中绝对没有 IMEI、SN、EAN、条码或其他禁止内容；因此发送按钮前必须人工检查独立的规格裁剪预览。正式 smoke 继续使用事先由员工人工检查、只含虚构品牌/型号/RAM/容量文字的合成规格图。任何真实图片都只能在确认后的规格裁剪符合上述边界时外发。

`store:false` 不等于 Zero Data Retention；默认安全监控可能保留输入/输出最多约 30 天。Owner 仍需确认该边界以及适用的 DPA、法律基础、员工告知、数据区域/跨境与删除流程。

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

one-photo 本地识别默认开启，不需要新的 secret。紧急停用 iPhone 的 ZXing/Tesseract 回退时，在 Vercel 设置下列构建时变量并重新部署；原生浏览器 Detector、手工扫描和手工录入仍可使用：

```dotenv
NEXT_PUBLIC_INVENTORY_LOCAL_IMEI_RECOGNITION=0
```

重新设为 `1` 或删除该变量并重新部署即可恢复。OCR 运行文件由锁定的 npm 包在 `prebuild` 阶段复制到 `/vendor/tesseract/v7.0.0/`；不得改回 Tesseract 默认 CDN 路径。具体资产合同见 `docs/LOCAL_OCR_ASSETS.md`。

休眠部署和 smoke 前预检期间，生产保持 `AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0`、`AI_VISION_INTAKE_ENABLED=0`、`AI_DRAFT_APPLY_ENABLED=0`；订单文字任务拥有的 master/order/maintenance/allowlist 状态不得由本任务回退或覆盖。预检通过并记录零用量基线后，才把前三项分别切为 `1`、重新部署，并再次证明 allowlist 只有 Chinatech、`AI_PUBLIC_CUSTOMER_ASSISTANT_ENABLED=0`。这次短时开放只授权紧接着执行的一次正式 UI smoke；任一检查不符必须立即 flags-first 回退，不得重试。

Production secrets 只允许从平台 secret store 注入：`OPENAI_API_KEY`、`AI_ASSISTANT_SAFETY_IDENTIFIER_SECRET`、`AI_ASSISTANT_REQUEST_FINGERPRINT_SECRET`、`CRON_SECRET`。它们必须各自独立；API Key 也不得与任一 HMAC secret 相同。不得放入 Git、任务记忆、日志、截图、浏览器 Bundle 或 `NEXT_PUBLIC_*`。

## 发布顺序

1. 核对独立 Vision D4 和订单文字 `TASK-20260718-014` 已释放生产写锁；不并发修改 Supabase、Vercel、`main` 或正式域名。
2. 刷新 `origin/main`、生产部署、v2 policy、开放 reservation、Vercel flags 和 Chinatech allowlist；要求 v2 精确 attestation 通过、Vision usage/open/audit 仍为 `0/0/0`。不得改写已应用 migration 或重建 policy。
3. 将本候选重放到最新 `main`，重跑质量、安全与构建门后推送 exact reviewed SHA；部署时维持 Vision 外发、Vision intake 与 draft apply 三项为 `0`，保留订单文字现状。
4. 验证休眠部署的 exact SHA、正式域名、登录、手工入库、运行日志和零 Vision 基线；准备一张事先人工检查过、仅含虚构包装规格文字、无标识符/PII/无关背景的合成 smoke 图，并记录基线时间与 ledger 计数。
5. 仅在前四步全部通过后，把 `AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED`、`AI_VISION_INTAKE_ENABLED`、`AI_DRAFT_APPLY_ENABLED` 切为 `1` 并重新部署；再次确认 Chinatech-only allowlist 和 Public AI 关闭。
6. 进入单一测试操作者维护窗口：只允许指定测试账号使用 Vision，其他员工继续手工入库；立即通过正式 UI 执行一次且仅一次合成无 PII 规格图 smoke。禁止直连 provider、真实客户数据、第二次上传或自动重试。
7. smoke 必须同时满足 HTTP 200、严格 Schema、`identifiers=[]`、provider attempt `1`、Vision ledger/audit 相对基线都精确增加 `1`、ledger `succeeded`、usage 已结算、audit `succeeded`、无敏感日志且零自动库存写入。`sent_unknown`、任何 delta 不是 `+1` 或任一其他检查不符，都必须立即关闭三项 Vision 开关并结束发布；保守结算已有 reservation，不得把未知/失败转成第二次付费尝试。
8. smoke 通过后保持 Chinatech-only 三项开关；在产生真实调用的平台检查候选复核与未保存草稿，在另一平台只验证入口、手工下一步、响应式布局和禁用/失败状态，避免消耗第二次 provider 请求。
9. 观察 30 分钟期间继续维持单一测试操作者窗口，不允许新的 Vision 上传；核对请求数仍为基线 `+1`、错误/取消、预留/结算/hold、Token、micro-USD、延迟桶、审计可用性与零自动库存写入。观察通过后才允许 Chinatech 员工在批准范围内使用。24 小时复核后只决定保留或关闭；第二店或扩大范围需新 D4。

## 立即停止与回滚

出现跨店/越权、禁止图片内容外发、日志出现图片/正文/secret、未预留 dispatch、政策 attestation 不一致、重复 provider 尝试、Vision ledger/audit delta 不是精确 `+1`、`sent_unknown`、未收敛 hold、预算越界、严格 Schema 失败、客户端处理超过 75 秒 watchdog、手工“下一步”受阻或手工入库不可用时，立即：

1. `AI_VISION_INTAKE_ENABLED=0`、`AI_DRAFT_APPLY_ENABLED=0`、`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0` 并重新部署；
2. 保守结算已有 Vision reservation，不删除账本；
3. 必要时回滚 Web exact SHA，但保留既有 v2 policy 与已验证订单文字功能；
4. 只有共享 provider/预算/权限边界失守时才关闭 `AI_ASSISTANT_ENABLED` 或停用 v2 policy；
5. 怀疑 secret 暴露时轮换对应 secret，再更新平台并重新部署。

若问题仅发生在 iPhone 本地 IMEI/OCR Worker，不涉及外发、预算或权限边界，优先设置 `NEXT_PUBLIC_INVENTORY_LOCAL_IMEI_RECOGNITION=0` 并重新部署；这会回退到原生 Detector 或手工扫描/录入，不需要数据库回滚。若怀疑完整标签进入网络请求、外部日志或 provider，必须按上面的三项 Vision flags-first 回退处理，并保留证据调查，不能只关闭本地 Worker。

不得用 DROP/DELETE 清理治理账本，也不得用重新创建 Key 代替根因调查。
