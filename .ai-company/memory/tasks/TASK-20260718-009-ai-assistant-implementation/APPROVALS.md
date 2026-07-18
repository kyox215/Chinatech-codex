# Approval Register — TASK-20260718-009-ai-assistant-implementation

| Decision | Status | Evidence / condition |
|---|---|---|
| 按完整计划 Phase 0-5 分阶段实施 | approved | Owner 当前会话明确指令 |
| 完成后 scope-only 推送并部署 | approved with gates | Owner 明确指令；需质量、安全、数据、CI、回滚门禁 |
| 创建新的 OpenAI API Key | approved and completed locally | Owner 回复“创建新密钥”与保存 `.env.local` 回复“是”；不记录值 |
| 本地 Key 保存到 ignored `.env.local` | approved and verified | `.gitignore` 覆盖 `.env*.local`；无明文输出 |
| OpenAI API 月度/日预算硬上限 | pending | 首次付费/真实调用前需要 Owner 数值 |
| 发送真实客户/IMEI/设备图片给 OpenAI | pending | 只允许脱敏/合成 fixture，生产发送前需隐私批准 |
| `store:false`、DPA、ZDR/MAM、EU residency/transfer、隐私告知与删除策略 | pending | 发布真实数据功能前需要 Owner/隐私顾问确认 |
| Phase 3 生产 migration apply | pending | 需要 linked dry-run、恢复、RLS/Grants、执行级批准 |
| 模型参与正式写入 | rejected by plan | 模型不注册正式写入工具；员工通过现有表单确认 |
| Public customer assistant 设计和 default-off 实现 | approved in scope | 可实现并测试；不得公开激活 |
| Public customer assistant 生产激活 | pending | 独立认证/隐私/滥用/发布批准 |
| 新增官方 `openai` Node SDK 生产依赖 | pending | Architecture 推荐；live provider 实现前需 Owner 批准依赖变化 |
| 新增 `sharp` 安全图片解码/清元数据依赖 | pending | Phase 2 真实图片管线前需 Owner 批准依赖变化 |
| Phase 1 default-off/fake 员工只读助手 | completed | 全量质量门禁、6 条 E2E、脱敏截图和独立复核通过 |
| Phase 2 default-off/fake 页面内库存草稿 | completed | 全量质量门禁、10 条 Phase 1+2 E2E、脱敏截图和独立复核通过；仅聚合审计持久化 |
| Tesseract 浏览器 OCR fallback | disabled pending approval | 禁止默认 CDN worker/core/lang；同源固定资源、CSP 与网络断言通过前不启用 |
| Phase 1 精确门店 rollout allowlist | implemented fail-closed | 无精确 `AI_ASSISTANT_STORE_ALLOWLIST` 时服务端 capability 关闭 |
| live provider durable atomic quota | pending hard gate | 当前本地单进程 quota 只用于 fake/default-off；live 前不得依赖它 |
| live provider 服务器 deadline/AbortSignal/safety identifier | pending hard gate | 首次真实外部调用前完成并复核 |

`pending` 项不阻塞 fake provider、默认关闭代码、单元测试、ADR、UI 原型和非生产脱敏验证。
