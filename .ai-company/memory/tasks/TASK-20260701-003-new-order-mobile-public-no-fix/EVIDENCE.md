# Evidence

## 测试

- `npm run test -- src/features/orders/model/order-public-no.test.ts src/features/orders/testing/mock-api.test.ts`：2 files / 37 tests passed。
- `npm run typecheck`：passed。
- `npm run test -- src/features/orders`：17 files / 88 tests passed。
- `npm run lint`：passed。
- `npm run test`：41 files / 247 tests passed。
- `npm run build`：sandbox 首次因 Turbopack 本地端口绑定权限失败；授权环境重跑 passed。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 REPAIRDESK_E2E_BUSINESS_DESKTOP=1 npx playwright test tests/e2e/visual-overflow.spec.ts`：6 passed。

## 自定义浏览器验证

- `/orders/new` at 390px：overflow 0；移动端提交栏可见文字只有 `创建工单`；提交栏金额条不可见；报价/服务设置区未被底栏遮挡。
- `/orders/new` at 430px：overflow 0；移动端提交栏可见文字只有 `创建工单`；提交栏金额条不可见；报价/服务设置区未被底栏遮挡。
- `/orders/new` at 1024px：overflow 0；桌面提交栏保留 `总额 / 定金 / 尾款 / 创建工单`。
- `/orders/new` at 1440px：overflow 0；桌面提交栏保留 `总额 / 定金 / 尾款 / 创建工单`。
- 移动端 390px mock 创建流程：填写电话、姓名、品牌、型号、故障备注后点击创建，成功跳转 `/orders/ord_new_...`，详情返回 `public_no=R2026050`，overflow 0。

## 截图

- `screenshots/TASK-20260701-003-new-order-mobile-public-no/mobile-390-bottom.png`
- `screenshots/TASK-20260701-003-new-order-mobile-public-no/mobile-430-bottom.png`
- `screenshots/TASK-20260701-003-new-order-mobile-public-no/desktop-1440.png`
- `screenshots/TASK-20260701-003-new-order-mobile-public-no/mobile-390-create-after-click-debug.png`

## 额外回归结果

- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 REPAIRDESK_E2E_ORDER_AUDIT=1 npx playwright test tests/e2e/order-desktop-ui-audit.spec.ts` 未通过。
- 失败位置在已有订单详情的 `收款` 按钮点击被详情层其它元素拦截，或收款弹窗未出现；不是 `/orders/new` 本轮改动路径。
- 失败证据由 Playwright 输出到 `test-results/order-desktop-ui-audit-*`；后续可作为订单详情桌面交互单独修复。

## Supabase 生产迁移

- 项目：`ChinaTech_date` / `xluzcoduqsdvjoouqhkc`。
- 已应用 migration history：
  - `20260701070341 repair_order_public_no_default_repair`
  - `20260701070449 repair_order_public_no_generator_privileges`
- 迁移前 schema 证据：`repair_orders.public_no` 的 `column_default` 为 `null`，`generate_repair_order_public_no()` 不存在，`missing_public_no_count=0`，`order_count=20`。
- 迁移后 schema 证据：`column_default=generate_repair_order_public_no()`，sequence/function 均存在，`missing_public_no_count=0`，`order_count=20`。
- 权限证据：`generate_repair_order_public_no()` 的 routine privilege 只剩 `service_role EXECUTE`；`PUBLIC`、`anon`、`authenticated` 无执行权限。
