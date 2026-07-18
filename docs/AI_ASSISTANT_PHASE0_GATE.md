# RepairDesk AI 小助手 Phase 0 架构、安全与放行包

- Task: `TASK-20260718-009-ai-assistant-implementation`
- Date: 2026-07-18
- Baseline: `origin/main@51d5b3b9648e77b355bb5635edf8df4c431eeb74`
- Current conclusion: **safe implementation GO / live data NO-GO / production migration NO-GO**
- Authoritative plan: `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md`
- ADR: `.ai-company/memory/decisions/ADR-20260718-001-bounded-ai-assistant-bff.md`

## 1. Scope decision

现在可以继续：

- 隔离分支内的默认关闭代码。
- Strict Zod/JSON Schema、fake provider、合成 fixture。
- 员工订单只读 UI 和服务器编排。
- 图片复核 UI、页面内存草稿与现有表单应用。
- 不读取 Key、不发网络、不写生产数据的测试。

现在不可执行：

- 真实客户消息、姓名、电话、订单、IMEI、序列号或图片发送给 OpenAI。
- 新增 `openai` / `sharp` 生产依赖，直至 Owner 批准依赖变化。
- 任何 Phase 3 生产迁移、Storage bucket、cleanup job 或 linked apply。
- AI 草稿正式写入、公开客户入口激活或客户外部通信。

## 2. 数据流

### Phase 1 — 员工订单查询

```text
员工消息
→ RepairDesk BFF 验证 session / active store / feature / permission / quota
→ provider 只返回严格的只读意图
→ BFF 再次验证工具参数与权限
→ 现有 order service/repository 在 actor/store scope 内查询
→ 服务器构造最小 DTO 和 /orders/:id 链接
→ 浏览器显示 RepairDesk 来源卡片
```

模型不接收 `store_id`、actor ID、数据库 ID 或工具查询结果。MVP 不持久化聊天正文。

### Phase 2 — 设备标签识别

```text
员工拍照/选图
→ 客户端预览与本地条码/OCR候选
→ BFF 验证权限、大小、MIME、magic、配额
→ 安全解码、定向修正、清 EXIF/GPS、限制像素/帧、重编码
→ 单次 Responses Structured Output (store:false)
→ 服务器合并视觉 + 条码/OCR + Luhn
→ 员工逐字段接受/修改/清空/拒绝
→ 仅确认且已映射字段应用到受控库存表单
→ 员工点击现有“保存商品”后才发生正式写入
```

成本、售价、整备成本、成色、所有权、激活锁、真伪和盒内实物配置永不由 AI 填写。

## 3. 权限与 capability

服务端必须返回并在门店/会员/权限变化时使其失效：

```ts
type AiAssistantCapabilities = {
  canUseOrderAssistant: boolean;
  canUseVisionIntake: boolean;
  canApplyInventoryDraft: boolean;
  reason?: "feature_off" | "permission_denied" | "rollout_not_enabled";
};
```

- 订单助手入口复用 `order:list`；单笔摘要复用 `order:detail`。
- 视觉识别复用 `inventory:create`；同店重复检查另需 `inventory:read`。
- Viewer 首版关闭；Technician 继续受 `activeMembershipId` assigned scope 限制。
- UI 只消费 capability，不按角色名重新实现权限矩阵。
- authority fingerprint 改变时 abort 请求并清除会话、图片和未保存草稿。

## 4. 威胁模型与强制控制

| Threat | Severity | Control | Verification |
|---|---:|---|---|
| 模型生成 B 店 ID 或 store_id | P0 | 请求和模型不接受 store；服务端 actor 注入；repository 同店过滤 | A/B 店负面集成测试 |
| `store:false` 被误认为 ZDR | P0 | live gate 单独批准 DPA/ZDR/MAM/区域/告知/删除 | 审批表与供应商设置证据 |
| service role 绕过 RLS | P0 | 只复用现有 permission/service/repository；模型无 repository access | 权限矩阵与工具调用次数 0 断言 |
| 图片伪 MIME/polyglot/解压炸弹 | P1 | JPEG/PNG/WebP allowlist + magic + 真实解码 + 16MP/4096px/单帧 + 重编码 | 恶意上传套件 |
| EXIF/GPS 泄露 | P1 | 原图仅内存；定向后重编码；派生图无 metadata | metadata diff |
| OCR/二维码 prompt injection | P1 | 所有识别内容视为数据；无 Web/SQL/MCP/写工具 | 对抗 fixture |
| Prompt/IMEI/图片写入日志 | P1 | AI 专用 allowlist audit；只存版本、计数、桶、状态 | audit snapshot |
| 模型业务卡幻觉 | P1 | 卡片只由已授权服务结果生成 | provider 文本不能创建卡片 |
| 双击/重试重复正式写入 | P1 | Phase 3 RPC、唯一幂等键和 version CAS；此前不提供 AI 写入 | 并发 20 次测试 |
| Vercel env 不是即时开关 | P1 | 默认关闭部署 + 运行时 gate/预建 disabled deployment + rollback | 发布演练 |

## 5. 图片合同

- MVP 每次 1 张；长期最多 4 张。
- 接受 `image/jpeg`、`image/png`、`image/webp`。
- 拒绝 HEIC/HEIF、SVG、PDF、GIF、animated WebP 与远程 URL。
- 单张原始上限 4 MiB；派生图保持 4 MiB 以下。
- 单边最多 4096px，总像素最多 16MP，单帧。
- 原图不持久化；若 Phase 3 使用 staging bucket，只存安全派生图且 24 小时内清理。
- 识别页明确显示“包装标签声明，不代表盒内设备真实性或所有权验证”。

## 6. AI 审计 allowlist

允许：事件、内部 request ID、provider/model/prompt/schema 版本、工具名、图片/结果/字段计数、Token 计数、延迟桶、状态与短错误码。

禁止：用户正文、prompt、OCR、tool arguments/result、模型原文、Base64、图片、URL/path/filename、客户姓名/电话、IMEI、序列号、完整订单字段和 secrets。

实现：`src/features/ai-assistant/server/audit.ts`。

## 7. Provider 与模型门禁

- Phase 0/自动化测试固定 `AI_ASSISTANT_PROVIDER=fake`。
- live 采用官方 `openai` Node SDK 的决定为 proposed；依赖批准前不安装。
- SDK 必须 `maxRetries:0`；应用层总 deadline 60 秒，文本 20 秒、视觉 45 秒，最多 2 次有限重试。
- Responses 请求固定 `store:false`、strict Schema、有限输出、不用 Conversations/Files/background/MCP/Web。
- 模型名必须来自服务端配置；没有明确模型配置时 live provider fail closed。
- 首轮候选模型由合成黄金集按准确率、延迟和成本选择，不能只按“最新”选择。

## 8. 黄金集

完整目标至少 200 张，全部合成或明确授权并不可逆脱敏；调参集与锁定回归集分离。本次用户原图不复制进仓库。

首批 24 个种子场景：

| Group | Count | Coverage |
|---|---:|---|
| 清晰单标签 | 4 | 不同品牌/排版/颜色/RAM/存储 |
| 单/双标识符 | 4 | IMEI1/2、serial、EAN、无标识符 |
| 图像质量 | 5 | 旋转、眩光、模糊、暗光、裁切 |
| 冲突/未知 | 4 | OCR/条码冲突、未知型号、缺字段、相似容量 |
| 非目标图片 | 3 | 设备外观、收据、空白背景 |
| 安全对抗 | 4 | 恶意文字、QR injection、EXIF GPS、伪 MIME |

每个 case 标注字段真值、证据区域、期望 confidence、identifier Luhn、是否必须人工复核和禁止输出。种子 manifest 在 Phase 2 建立；真实供应商调用前必须锁定回归集。

## 9. UI 实施裁决

- 桌面/平板：AppBar 搜索与扫码之间的 AI 按钮，打开 440–480px 右侧 Sheet。
- 手机订单页：AppBar 与 Dock 都隐藏，必须在订单 Floating Header 加 AI 按钮。
- 其他手机模块：复用快捷 Sheet 的 assistant action，不新增全局悬浮气泡。
- 库存新增表单当前为非受控 FormData；Phase 2 必须先建立受控 form state 和无损 merge。
- 同一时刻只允许一个 modal 宿主；从 IntakeDialog 内启动识别时在同一 Dialog 内切换步骤。
- 人工值与 AI 冲突时默认保留人工值，员工明确选择覆盖。
- RAM、IMEI2、EAN、SKU 在 MVP 显示为未映射，不塞入 notes。

## 10. Owner 审批表

| Decision | Current status | Required before |
|---|---|---|
| 完整 Phase 0–5 默认关闭实现 | approved in current task | safe implementation |
| 新 API Key 保存 ignored `.env.local` | completed | local secret presence only |
| 增加 `openai` Node SDK 依赖 | pending | live provider implementation |
| 增加 `sharp` 服务器图片依赖 | pending | Phase 2 安全图片管线 |
| 每日/每月 API 预算与门店硬限额 | pending | first paid request |
| 真实客户/订单/标识符/图片发送 OpenAI | pending | any live external request |
| DPA/ZDR/MAM/EU residency/transfer/告知/删除 | pending | live data feature |
| Phase 3 schema/bucket/cron linked apply | pending | production migration |
| AI 草稿首批正式 apply 角色/门店 | pending | write rollout |
| Public customer assistant production activation | pending | public release |

## 11. 数据与发布边界

- Phase 3 采用 additive expand；旧 `storage_capacity`/`serial_or_imei` 保留。
- 目标环境 `inventory_items.id` 可能存在 text/uuid 漂移，迁移前必须查询 catalog，不能猜类型。
- 新 AI 表 `store_id not null`、同店复合 FK、RLS、显式最小 Grants、索引、TTL、版本 CAS 与唯一幂等键缺一不可。
- 当前项目 broad production DB gate 仍有未关闭恢复/遗留表问题；AI 局部迁移即使正确也只能“有条件”，不能宣称全库 green。
- 发布先部署所有 flags off；再按 staff read-only → vision shadow → draft apply 小白名单推进。
- 任何跨店、未授权写入、secret/PII 日志或未经确认 identifier 应用立即回滚。

## 12. Phase 0 退出证据

- 三份只读报告已完成：Product/UX、Architecture/API、Data/Security/QA/Release。
- Strict 合同：`src/features/ai-assistant/model/contracts.ts`。
- 默认关闭 flags 与双批准 live gate：`src/features/ai-assistant/server/feature-flags.ts`。
- Provider interface 与 fake provider：`src/features/ai-assistant/server/provider.ts`、`testing/fake-provider.ts`。
- AI 审计 allowlist：`src/features/ai-assistant/server/audit.ts`。
- 当前结论：**Phase 0 safe slice pass；live activation conditional/blocked by Owner decisions above**。

## 13. 当前官方依据

- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI strict function calling](https://developers.openai.com/api/docs/guides/function-calling#strict-mode)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- [OpenAI GPT-5.4 mini model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [OpenAI JavaScript SDK](https://github.com/openai/openai-node)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Supabase explicit Grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel instant rollback](https://vercel.com/docs/instant-rollback)
