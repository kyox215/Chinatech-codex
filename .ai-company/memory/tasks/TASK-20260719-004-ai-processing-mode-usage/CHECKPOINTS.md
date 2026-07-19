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
