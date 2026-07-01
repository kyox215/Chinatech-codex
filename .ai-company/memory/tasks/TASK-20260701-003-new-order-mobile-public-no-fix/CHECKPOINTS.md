# Checkpoints

## 2026-07-01T03:10:00+02:00

### 结论

新建工单移动端去重、底部遮挡和 `public_no` 创建失败修复已完成并通过核心门禁。

### 已完成

- 移动端提交栏移除金额三联卡，只保留主按钮。
- 报价处理卡保留唯一金额汇总，去掉 `报价项目` header 右侧重复总额。
- 表单底部留白改为匹配新的固定按钮高度，服务设置底部控件可见。
- 创建工单前应用层调用 `generate_repair_order_public_no()`，失败时使用 `R + timestamp + attempt + entropy` fallback。
- `public_no` 相关 not-null / unique 失败会重试，最终返回中文友好错误。
- 新增迁移恢复 sequence、RPC 和 `repair_orders.public_no` 默认值。
- 发布时追加权限收紧迁移，撤销 generator function/sequence 的 `PUBLIC` 权限，只保留 `service_role`。
- 新增纯函数和 mock API 测试覆盖 public_no 生成与错误分类。

### 验证

- Lint/typecheck/Vitest/build passed。
- Playwright `/orders/new` 390/430/1024/1440 检查 passed。
- Playwright 主路由 `visual-overflow` spec passed。
- 移动端 mock 创建流程 passed，并生成 `R2026050`。

### 残余风险

- Supabase 远端迁移已应用到 `ChinaTech_date` / `xluzcoduqsdvjoouqhkc`。
- 扩展运行的 `order-desktop-ui-audit` 暴露订单详情桌面收款按钮点击拦截问题，非本任务改动范围，需要独立排期。

### 下一步

- 若要复核线上 schema，检查 migration history 中 `20260701070341 repair_order_public_no_default_repair` 和 `20260701070449 repair_order_public_no_generator_privileges` 均存在。
- 可另开任务修复订单详情桌面收款按钮被层叠元素拦截的问题。
