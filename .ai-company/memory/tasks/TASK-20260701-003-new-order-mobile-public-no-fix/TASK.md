# TASK-20260701-003 新建工单移动端去重与 public_no 修复

## 任务目标

- 修复 `/orders/new` 移动端报价金额重复、底部固定栏遮挡服务设置的问题。
- 修复创建工单时 `repair_orders.public_no` 为空导致保存失败的问题。
- 保持订单状态机、付款、审批和 WhatsApp 业务规则不变。

## 范围

- UI：新建工单页移动端底部提交栏、报价处理卡、服务设置区域。
- 后端：创建工单前生成 `public_no`，失败时返回中文友好错误。
- 数据库：新增兼容迁移，恢复 `repair_order_public_no_seq`、`generate_repair_order_public_no()` 和 `repair_orders.public_no` 默认值。
- 测试：订单编号纯函数测试、mock 创建测试、订单专项、全量测试、构建和 Playwright 视觉/溢出检查。

## 不在范围

- 不重做订单管理列表和订单详情。
- 不修改生产数据、权限模型、真实付款规则、审批规则或 WhatsApp 发送逻辑。
- 不自动应用 Supabase 远端迁移。

## 关键文件

- `src/features/orders/forms/new-order-submit-bar.tsx`
- `src/features/orders/forms/new-order-quotation-section.tsx`
- `src/features/orders/screens/new-order-screen.tsx`
- `src/features/orders/model/order-public-no.ts`
- `src/features/orders/model/order-public-no.test.ts`
- `src/features/orders/server/order.repository.ts`
- `src/features/orders/testing/mock-api.test.ts`
- `supabase/migrations/20260701070341_repair_order_public_no_default_repair.sql`
- `supabase/migrations/20260701070449_repair_order_public_no_generator_privileges.sql`

## Agent 使用

- no-spawn reason：本任务是已批准的单路径修复，涉及同一创建流程的 UI、repository、migration 和测试，主线程作为单一写入者更安全；未真实生成子代理。
