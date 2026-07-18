# RepairDesk AI 拍照识别入库草稿运行说明

## 当前交付边界

当前能力只为已登录且有库存权限的员工提供“拍照识别 → 人工复核 → 回填现有表单”。识别和“应用确认字段”都不会创建库存记录；只有员工返回普通入库表单并点击 `保存商品` 后，现有 `createInventoryIntake` 流程才会执行正式写入。

当前实现仍以本地条码/OCR 为第一路径；当品牌、型号、RAM、存储四个关键字段完整且无冲突/无效标识符时，不创建上传 data URL，也不请求云端。Phase 3B 已实现真实 OpenAI vision fallback 和 durable 费用结算，但全部生产旗标、图片数据外发批准与数据库政策仍关闭，因此生产不会发送图片。图片不写入数据库或 Storage；识别、复核和应用不会写库存、订单、草稿或图片业务记录。

## 安全图片边界

- 只接受 JPEG、PNG、静态 WebP；同时核对浏览器声明类型和文件 magic bytes。
- 在浏览器完整解码前先读取 JPEG/PNG/WebP 图片头并拒绝超大声明尺寸；完整解码后再次核对实际尺寸及声明一致性，减少压缩/像素资源炸弹风险。
- 原图最大 4 MiB，最大边长 4096 像素，总像素不超过 1600 万。
- APNG 与动画 WebP 拒绝处理；浏览器完成真实解码后，用 Canvas 重新编码为不超过 2.4 MB 的 JPEG，从而移除 EXIF/GPS 等元数据。
- BFF 在认证后执行 3.4 MB 请求上限，并再次验证 canonical base64、MIME/magic、动画、实际字节数和图片头尺寸。
- 替换照片、关闭弹窗、取消识别、离线或门店/权限变化时，中止请求并释放对象 URL；离线照片不会排队上传。
- 原图、文件名、OCR 原文和完整标识符不进入普通日志、审计、任务记忆或截图。
- 云端 schema 强制 `identifiers=[]`：IMEI/SN 只允许由本地扫码/OCR或人工录入处理，不能采用云端返回的标识符。员工必须尽量只框入规格标签并避开人脸、证件、客户资料和支付信息；当前尚无可证明的自动裁切/遮挡，因此视觉 live canary 必须独立审批，不能跟随文字 canary 自动开启。

浏览器原生 TextDetector 与仓库内打包的 ZXing 只产生临时候选；图片中的文字始终作为不可信数据，不作为指令执行。Tesseract fallback 已关闭，避免默认从第三方 CDN 加载 worker、WASM 或语言数据；只有固定版本资源同源托管并通过 CSP/网络断言复核后才可重新启用。服务器审计只记录事件、状态、模型版本、数量、字节/延迟桶和 Token 聚合。

本地充分性是保守成本门：四个关键字段必须全部存在，且仍逐字段人工复核；不支持 TextDetector 的浏览器通常会进入服务端 fallback。真实门店“本地命中率”必须先用锁定清晰标签集建立 baseline，不得把 70% 目标写成现有生产保证。完整成本合同见 `docs/AI_ASSISTANT_COST_GOVERNANCE.md`。

## 人工复核与字段映射

- 每个候选显示来源、置信度、证据摘要和冲突状态，可逐字段接受、修改、清空或拒绝。
- 人工已填值默认优先；只有员工明确接受覆盖时才替换。
- Phase 2 仅映射品牌、型号、颜色、存储容量和一个通过校验并由员工选定的主 IMEI/序列号。
- RAM 和额外标识符继续可见，但明确标记为未映射；成本、售价、成色、所有权、激活锁和真伪不会由 AI 填写。
- 页面始终提示识别结果只是包装标签声明，不代表设备实物配置、真伪或所有权已经验证。
- `AI_DRAFT_APPLY_ENABLED=0` 时仅允许影子复核，不允许把候选应用到表单。

## 默认关闭与本地验证

部署环境必须保持：

```dotenv
AI_ASSISTANT_ENABLED=0
AI_VISION_INTAKE_ENABLED=0
AI_DRAFT_APPLY_ENABLED=0
AI_ASSISTANT_PROVIDER=fake
AI_ASSISTANT_STORE_ALLOWLIST=
AI_ASSISTANT_REQUESTS_PER_STORE_DAY=0
AI_ASSISTANT_REQUESTS_PER_ACTOR_MINUTE=30
AI_ASSISTANT_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_VISION_EXTERNAL_DATA_APPROVED=0
AI_ASSISTANT_BUDGET_APPROVED=0
```

仅在本地合成 E2E 中，才可为测试门店临时启用主开关、视觉开关、草稿应用开关和精确门店 allowlist。不要把测试配置复制到生产。

发布前执行：

```bash
npm run lint
npm run typecheck
npm run test
npx next build --webpack
```

再运行 `tests/e2e/ai-inventory-intake.spec.ts`，覆盖 1280/430/390px、识别、人工接受、应用后未保存、零库存写请求、取消、离线和无横向溢出。证据截图必须使用合成数据，并遮挡任何完整标识符。

## Live provider 与生产数据门禁

以下条件全部完成前，真实 vision fallback 必须继续安全失败：

1. Owner 批准明确的 API 日/月预算与门店硬上限；
2. Owner/隐私负责人批准真实图片和标识符外发、DPA、ZDR/MAM、欧盟数据区域/传输、隐私告知与删除策略；
3. 验证现有 Canvas 清元数据、服务端 magic/dimension/animation 校验和 Base64 上限满足批准的数据范围；如需要真正裁切/自动遮挡，再单独批准依赖与交互；
4. 服务器 deadline/AbortSignal、safety identifier、请求指纹、durable atomic quota、政策一致性证明和真实图片黄金集门禁全部通过；
5. 完成独立安全、权限、数据、E2E、发布和回滚复核。

原生 server-side Responses API 适配器使用 `store:false`、严格 JSON Schema、一次尝试、25 秒 provider deadline 和 1024 output-token 上限。但 `store:false` 不等于 Zero Data Retention；默认 abuse-monitoring 日志仍可能保留输入/输出最多约 30 天。图片数据范围必须单独完成 DPA/Article 28、法律基础、EU/ZDR/MAM 与告知确认。本地 `.env.local` 中的密钥不代表生产放行，也不得复制到客户端、Git、日志或截图。

## 回滚

先设置 `AI_DRAFT_APPLY_ENABLED=0`，再设置 `AI_VISION_INTAKE_ENABLED=0`；需要全局止损时设置 `AI_ASSISTANT_ENABLED=0` 并重新部署。手工入库流程必须始终可用。若仍有影响，回退部署；不要通过删除业务表处理应用故障。若怀疑密钥泄露，在 provider 控制台轮换密钥。
