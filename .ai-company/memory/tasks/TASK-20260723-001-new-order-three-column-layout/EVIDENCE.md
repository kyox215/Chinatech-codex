# Evidence

- 真实组件预览截图：`screenshots/TASK-20260723-001-new-order-three-column-layout/new-order-real-components-1306x900.png`
- 浏览器几何检查：视口 1306x900；表单 `clientHeight=866`、`scrollHeight=866`；工作区 `clientHeight=572`、`scrollHeight=572`。
- 三列位置：客户与设备 x=54；报价 x=407；手机密码与工单设置 x=949。
- 浏览器错误日志：0 条。
- `npx eslint src/features/orders/screens/new-order-screen.tsx src/features/orders/forms/new-order-quotation-section.tsx`：通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。

## Release evidence

- 发布提交：`1996ffb75284412fc39998192b52d44b94f0c081`。
- GitHub：分支 `codex/orders-audit-remediation-20260722` 与 `main` 均已推送到该提交。
- Vercel 预览：`dpl_Bjt73fMNS3Ahzf6PvkDVNBShxnKB`，状态 READY。
- Vercel 生产：`dpl_CU8baHbFshhkQitDUGACAHPHh4XH`，状态 READY。
- 生产别名冒烟：`/orders` 正确重定向到 `/login?next=%2Forders`，最终 HTTP 200。
- 新生产部署错误日志：最近十分钟无 error 记录。
- 响应式 E2E：390、430、768、1024、1280、1440 均通过；开发服务器连续热更新时曾出现瞬时脚本解析错误，稳定后分断点复跑通过。
- 全量 Vitest 首轮：2241 通过、3 个设置页测试出现超时/输入异常；同一设置页文件单独复跑 20/20 通过，订单相关 527/527 通过。
- 生产构建：webpack 路径通过；Turbopack 本地路径仅因隔离工作树 `node_modules` 符号链接越界而不可用，Vercel 真实依赖目录构建成功。
