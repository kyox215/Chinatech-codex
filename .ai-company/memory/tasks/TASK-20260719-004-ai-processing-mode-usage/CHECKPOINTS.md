## 2026-07-19T10:10:23Z — 本地/大模型显式选择与当前门店 AI 使用量视图已实现并完成质量门禁，状态为 pending_release_approval。

- **Phase:** quality-gated-pending-release
- **Completed/current state:** 本地/大模型显式选择与当前门店 AI 使用量视图已实现并完成质量门禁，状态为 pending_release_approval。
- **Next:** 等待 Owner 明确批准后再执行 scoped commit/push/deploy；发布前复核 live AI 门禁、finance:aggregate_read 与生产 smoke。
- **Decision:** 默认本地、显式模型、旧客户端保持自动兼容；使用量复用 store_day 账本，不调用组织级 Usage API。
- **Blocker:** 生产 push/deploy 属 D4，当前未获本任务的单独发布批准。
- **Evidence:**
  - lint 与 typecheck 通过；Vitest 308 文件、1966 项通过。
  - Webpack 生产构建通过；Turbopack 仅因隔离 worktree 的 node_modules 外部软链接受限。
  - 核心 Playwright 2/2 通过，AI 10 个场景均逐项通过；390px/1280px/设置用量截图已保存。
  - 未新增 migration，未修改密钥、生产配置或生产数据。
- **Recorded by:** IntegrationLead

## 2026-07-19T10:59:52Z — 对话内今日大模型用量已实现并完成发布前门禁，Owner 已批准 scoped push/deploy。

- **Phase:** release-ready
- **Completed/current state:** 对话面板复用当前门店聚合用量，显示 `order_text` 今日请求/额度、总 Token 和已结算估算；无财务聚合权限不发请求，用量错误不影响聊天，模型成功后刷新共享缓存。
- **Next:** 获取 integration lease，复核远端 `main` 与 Vercel 目标，提交并推送 exact SHA，完成生产 smoke、截图和观察。
- **Decision:** 不新增 API、migration、依赖、密钥或配置；设置页与对话页共用 `aiAssistantKeys.usage(activeStoreId)`。
- **Blocker:** 无本地实现阻塞；外部步骤前必须确认 orchestration lease 与远端 lineage。
- **Evidence:**
  - 相关 Vitest 23/23；全量 Vitest 309 文件、1972 项通过。
  - lint、typecheck、Webpack production build 通过。
  - AI Playwright 10/10 通过；390px/1280px 对话用量截图已视觉复核，无横向溢出。
  - 安全复核确认客户端无 store/model/key/budget 参数，服务端权限和 actor.storeId 边界未改变。
- **Recorded by:** IntegrationLead
## 2026-07-19T11:00:59Z — 对话内当前门店今日大模型用量已实现，发布前质量、安全和浏览器门禁通过，Owner 已批准 scoped push/deploy。

- **Phase:** release-ready
- **Completed/current state:** 对话内当前门店今日大模型用量已实现，发布前质量、安全和浏览器门禁通过，Owner 已批准 scoped push/deploy。
- **Next:** 获取并复核 integration lease；fetch origin/main；提交 exact candidate；推送、部署、生产 smoke、截图与观察。
- **Decision:** 复用 aiAssistantKeys.usage 当前门店缓存；仅 finance:aggregate_read 查询；模型成功刷新；无 migration/密钥/配置变更。
- **Blocker:** 无本地阻塞；外部步骤前必须确认 lease 与远端 lineage。
- **Evidence:**
  - lint/typecheck/build 通过；Vitest 309 文件 1972 项；AI Playwright 10/10；390px/1280px 对话用量截图已视觉复核。
- **Recorded by:** IntegrationLead

## 2026-07-19T11:18:00Z — AI 查询模式和当前门店使用量已完成 exact-SHA 生产发布与冒烟。

- **Phase:** production-released
- **Completed/current state:** `main@f91327ca` 已由 Vercel exact-SHA 构建并显式提升到 `www.chinatech.in` / `chinatech.in`；设置用量页、聚合 API、移动响应式、日志和域名映射通过生产复核。
- **Next:** 提交关闭证据，复核最终远端/部署状态，运行严格治理门禁与 memory checkpoint，关闭 Registry task/run/lease。
- **Decision:** 保持现有 Chinatech-only AI pilot；当前 `xutech` 生产会话按 `rollout_not_enabled` 隐藏入口，不修改 allowlist 以制造截图。
- **Blocker:** 无发布阻塞；生产会话不是 Chinatech pilot，因此对话内卡片的最终视觉证据来自 exact-SHA E2E 和本地 390px/桌面截图。
- **Evidence:**
  - Vercel deployment `dpl_6LZ4gT89EkTCXqP7LAbLhy6aP3YA` READY，Git SHA 为 `f91327cab19367b745e66cd8c98d12fad4506adf`。
  - 检测到旧 queued build 抢占域名后已显式 promote exact deployment，并重新 inspect 确认两个生产 alias 正确。
  - 生产设置用量页和 `repairdesk_usage_ledger` 聚合接口通过；浏览器 console 与 error-level deployment logs 为空。
  - 无 migration、密钥、模型、预算、allowlist、生产配置或生产数据变更。
- **Recorded by:** IntegrationLead
