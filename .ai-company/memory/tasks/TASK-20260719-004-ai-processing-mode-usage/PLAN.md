# Plan — AI 查询处理方式选择与门店使用量

## Architecture decision

### Selected: existing store usage ledger

- 读取 `ai_assistant_usage_buckets` 的 `store_day` 行。
- 后端以已认证 actor 的 `storeId` 固定租户范围，最多读取最近 30 天的两类日桶。
- `finance:aggregate_read` 同时保护设置入口和 GET API。
- UI 只接收聚合的计数、Token 和 micro-USD 数值。

### Rejected: OpenAI organization Usage/Costs API

- 需要额外的组织管理员权限或密钥生命周期。
- 可能混入同一组织内其他项目或门店用量。
- 无法统计本地处理，且与 RepairDesk 自己的预算结算事实可能存在时间差。

## Work packages

1. 扩展 AI 请求合同与服务端路由语义，保持旧客户端兼容。
2. 在 AI 输入区实现双模式选择、动态隐私提示和加载文案。
3. 新增门店聚合 usage repository、GET API、客户端函数和查询键。
4. 新增设置导航、权限解析、按需查询和完整状态组件。
5. 添加合同、服务、路由、聚合、设置和交互测试。
6. 完成 lint、typecheck、test、build、390px/桌面截图及关闭检查。

## Plan delta — 对话内用量与生产发布（2026-07-19）

### WP-07 对话内使用量

- 在既有 AI Sheet 内复用 `aiAssistantUsageQueryOptions`，不增加 API 或数据口径。
- 仅在当前门店能力允许 `finance:aggregate_read` 时查询和展示。
- 用紧凑卡片展示今日模型请求/额度、总 Token 与已结算美元估算；本地模式明确为零模型调用。
- 提交成功后只刷新当前门店 usage query；失败只影响用量卡，不阻断对话。

### WP-08 发布前复核

- 覆盖权限、加载、成功、零用量、失败降级、刷新和响应式状态。
- 运行 lint、typecheck、全量 Vitest、生产 build 与 AI/usage Playwright。
- 截取 390px、桌面端对话内用量和生产结果；检查无敏感数据、秘密或跨店参数。

### WP-09 推送、部署与观察

- 发布单元为前一候选 `e7d743c1` 加本次对话内用量增量；无 migration、依赖或生产配置变化。
- 发布前获取并复核 integration lease、远端 `main` lineage、Vercel 项目/目标域与回滚 SHA。
- 推送 exact commit，验证生产部署绑定该 SHA；冒烟本地/模型选择、苹果 15 相关性、对话用量和设置用量。
- 异常回滚到部署前 SHA；用量 API 失败时不回滚数据，因为没有数据写入或 schema 变化。

## Dependencies

- 现有 AI feature gate、provider、egress、budget 和 audit 链路。
- 现有 `finance:aggregate_read` 权限投影。
- 已上线的 `ai_assistant_usage_buckets` 表；本任务不修改 schema。

## Verification and rollback

- 优先执行相关 Vitest，再执行全量 `npm run lint/typecheck/test/build`。
- 浏览器验证本地/大模型选择与设置用量的移动端、桌面状态。
- 回滚为单一代码提交，不触碰生产数据或配置。
