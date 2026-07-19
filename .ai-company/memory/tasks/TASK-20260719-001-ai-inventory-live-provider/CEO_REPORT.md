# CEO Report — Chinatech 库存图片标签 AI 单店发布

## 结论

**有条件关闭 / RELEASED。** 库存入库 Vision 客户端卡死修复已进入 `main`，Chinatech-only 图片标签识别与人工草稿应用已在生产开启。唯一批准的合成无 PII 图片请求成功返回 `NOVA / A7 PRO / BLUE / 8 GB / 256 GB`，没有自动创建或修改库存。

30 分钟生产观察从 reservation `2026-07-19T13:11:21.021029Z` 持续到最终聚合 `2026-07-19T13:42:19.925504Z`，完整通过。24 小时只读复核仍是后续门禁，因此本切片保持“有条件关闭”。这不授权真实客户图片、IMEI/SN/EAN、人物/证件、公开 AI、第二门店、自动写入、自动重试或预算/模型扩张。

## 根因与修复

手机端图片预览写入 `prepared` 状态后，依赖该状态的 React effect cleanup 会中止当前请求控制器，随后流程在仍为 working 的状态下返回。因此界面持续显示“正在移除照片元数据并识别标签”，但请求没有到达 BFF、Supabase reservation 或 OpenAI。

修复采用 ref/run-id 生命周期与卸载清理，增加 8 秒 FileReader 上限和 75 秒全链路 watchdog，从可选图片路径移除不可抢占的主线程 ZXing 回退，并把准备、本地识别、云端识别状态分开。过期完成不能覆盖新图片或清空后的状态，手工“下一步”始终保留。

## 生产验收矩阵

| 验收项                     | 结果    | 证据                                                                                                                       |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| 修复进入 `main` 并休眠部署 | PASS    | `main@50f843ddb2f5f734708c70144d8860e19d857dbc`; dormant `dpl_AXAgvZ9y1XRpgXouwwuYno23TcwD` READY                          |
| Chinatech-only 三门激活    | PASS    | Vision egress、intake、draft apply 三项 Production flags 由 `0` 切到 `1`; enabled `dpl_Gfqrd7rT2U8vo79qe7DRdD3P4eKm` READY |
| 唯一合成无 PII smoke       | PASS    | ledger/audit 各 `1`; provider attempt `1`; succeeded/usage-reported/settled; `5713` micro-USD                              |
| 结果与人工草稿             | PASS    | 五个预期候选；人工确认后仅填充未保存草稿；identifier 保持空白                                                              |
| 零自动库存写入             | PASS    | Chinatech `inventory_items` 基线与事后均为 `4`                                                                             |
| 手机与电脑端               | PASS    | 生产移动端完整 smoke；生产桌面端入口与手工路径；截图已目检                                                                 |
| 租户、账本与运行边界       | PASS    | other-store/open/non-success 均 `0`; AI 私有表 RLS `4/4`; anon/authenticated/PUBLIC 表权限 `0`                             |
| 30 分钟观察                | PASS    | `13:11:21.021029Z` 至 `13:42:19.925504Z`; request/attempt/audit `1/1/1`; errors/open/bad/other-store `0`; 禁止第二次上传   |
| 24 小时复核                | PENDING | 最早 `2026-07-20T13:11:21.021029Z` 执行只读 policy/ledger/audit/runtime 复核                                               |

## 安全与数据

- 正式 smoke 使用事先人工目检的虚构规格标签；PNG 为 1200×800 sRGB，不含 EXIF、ICC、XMP 或 IPTC，也没有人物、条码、证件、客户资料或设备标识符。
- 浏览器与服务端分别完整解码、去元数据并重编码；只有服务端净化后的包装规格裁剪图可进入 provider；原图不由应用保存，provider 请求使用 `store:false`。
- `has_safety_identifier=true` 表示发送了匿名化 OpenAI 安全标识控制，不是客户或设备 identifier。响应 schema 与页面 identifier 输入均保持无标识符。
- 四张 AI 治理表启用 RLS，客户端角色无表权限；账本、审计和错误日志不记录原图、识别正文、客户 PII 或 secret。

## 质量与独立复核

- Hotfix 候选通过 309 files / 1978 tests、26-page build、lint、typecheck、agents check、production audit `0`、Sharp `0.34.5`、legacy Playwright `6/6` 和 V2 Playwright `3/3`。
- 三名真实只读子 Agent 分别完成 Architecture、QA/UX、Security/Privacy/Release 复核；源码候选无未解决 blocker。最终集成、生产操作、Git 和关闭判断由 Integration Lead 串行完成。
- `main` 后续订单搜索提交没有改变 Vision 专属文件；关闭证据 `2e7ebc1e7fdb1f329570153999c175004579ef58` 已线性重放到最新 `origin/main`，5 个聚焦文件 / 43 项测试再次通过，并以快进方式推送。

## 视觉证据

- 生产移动端识别成功：`evidence/vision-production-mobile-success-20260719.png`
- 生产移动端人工应用、未保存草稿：`evidence/vision-production-mobile-applied-unsaved-20260719.png`
- 生产桌面端已启用入口：`evidence/vision-production-desktop-enabled-entry-20260719.png`
- 休眠态桌面/移动端：`evidence/vision-production-dormant-desktop-20260719.png`、`evidence/vision-production-dormant-mobile-20260719.png`
- 唯一测试素材：`evidence/vision-smoke-synthetic-spec-label.png` 与 `.svg`

## 回滚与后续

出现跨店、重复 attempt、未知计费、未收敛 reservation、PII/identifier 外发、自动库存写入、手工流程受阻或运行错误时，先把 `AI_VISION_INTAKE_ENABLED`、`AI_DRAFT_APPLY_ENABLED`、`AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED` 设为 `0` 并重新部署；保留 durable ledger，不执行删除或重试。

在 `2026-07-20T13:11:21.021029Z` 之后执行一次只读 24 小时复核，不上传第二张图片。任何第二门店、真实数据范围、模型、预算、自动写入或重试变化都必须新建 D4。
