# Evidence — TASK-20260720-001

## Implementation

- 客户列表四分组、更多筛选、URL 状态：`src/features/customers/model/customer-list.ts`、`screens/customer-list-screen.tsx`。
- 客户详情五分组、三主操作：`components/customer-detail-tabs.tsx`、`screens/customer-detail-screen.tsx`。
- 消息两步确认与内部链接移除：`forms/customer-message-dialog.tsx`。
- 列表浏览器字段投影：`server/customer.repository.ts`。
- 客户详情隐藏冲突浮钮：`src/components/mobile-workspace-dock.tsx`。

## Automated verification

- 定向测试：6 files / 38 tests passed。
- 客户响应式 E2E：8/8 passed；覆盖 390、430、768、1024、1440、1920。
- Full lint: passed。
- Full typecheck: passed。
- Full tests with constrained workers: 315 files / 2051 tests passed。
- Production build: passed；26 routes generated/validated。
- `git diff --check`: passed。

## Independent review

- FLOW：PASS；分页冷启动、768px 固定五分组与三主操作、popup 恢复提示均复核通过。
- UX：PASS；无 P0/P1，768–1023px 头部和底部操作会避开展开/收起侧栏。
- DATA/QA/SEC：app-only CONDITIONAL PASS；数据库仍为 NO-GO。
- 独立复跑 768px Playwright：1/1 passed。

## Residual follow-up

- 客户列表浏览器投影当前为已知敏感字段黑名单；下一次扩展列表字段前升级为显式白名单 DTO。
- “要跟进”分组与顶部数字的到期时间口径，在恢复数据库迁移门禁后统一到同一服务端合同。

## Visual verification

- 桌面列表：`/Users/kyox215/.codex/visualizations/2026/07/19/019f7c4d-6046-7ec0-b97c-744e4409035f/customer-list-desktop-1440.png`
- 移动列表：`/Users/kyox215/.codex/visualizations/2026/07/19/019f7c4d-6046-7ec0-b97c-744e4409035f/customer-list-mobile-390.png`
- 桌面详情：`/Users/kyox215/.codex/visualizations/2026/07/19/019f7c4d-6046-7ec0-b97c-744e4409035f/customer-detail-desktop-1440.png`
- 移动详情：`/Users/kyox215/.codex/visualizations/2026/07/19/019f7c4d-6046-7ec0-b97c-744e4409035f/customer-detail-mobile-390.png`
- 所有六档 DOM 测量均为 `scrollWidth <= clientWidth`。

## Database gate

- `supabase migration list --linked`: 远端存在 19 个本地缺失版本。
- `supabase db push --linked --dry-run --include-all`: 失败，原因是远端迁移版本在本地目录不存在。
- 结论：数据库应用 NO-GO；不得创建、修复或应用本任务迁移。无迁移应用代码仍可独立发布。
