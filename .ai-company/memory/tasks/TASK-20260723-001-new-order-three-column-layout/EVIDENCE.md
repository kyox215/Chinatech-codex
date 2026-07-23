# Evidence

- 真实组件预览截图：`screenshots/TASK-20260723-001-new-order-three-column-layout/new-order-real-components-1306x900.png`
- 浏览器几何检查：视口 1306x900；表单 `clientHeight=866`、`scrollHeight=866`；工作区 `clientHeight=572`、`scrollHeight=572`。
- 三列位置：客户与设备 x=54；报价 x=407；手机密码与工单设置 x=949。
- 浏览器错误日志：0 条。
- `npx eslint src/features/orders/screens/new-order-screen.tsx src/features/orders/forms/new-order-quotation-section.tsx`：通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。
