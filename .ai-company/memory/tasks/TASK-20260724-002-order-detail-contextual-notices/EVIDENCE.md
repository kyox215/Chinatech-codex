# Evidence

- 用户选择方案 A。
- 原始页面证据：顶部同时出现结束工单、设备保管和店铺打印资料提示，占用详情首屏。
- 代码落点：
  - `src/features/orders/components/order-terminal-actions.tsx`：新增紧凑终态呈现，复用原确认与 mutation。
  - `src/features/orders/components/order-hero.tsx`：增加终态 slot 与打印恢复 Popover。
  - `src/features/orders/components/order-overview-tab.tsx`：关键信息卡接收设备保管局部控制。
  - `src/features/orders/screens/order-detail-screen.tsx`：移除桌面顶部大提示并连接三个上下文入口；移动分支保持原结构。
- 自动化：
  - `npm run lint`：通过。
  - `npm run typecheck`：通过。
  - `npm run test`：346 个文件、2313 个测试全部通过。
  - `npm run build`：通过，27 个静态页面生成完成。
  - 新增 `order-contextual-notices.test.tsx`，验证打印阻塞按钮可聚焦并打开恢复弹层，以及终态紧凑操作入口。
- 独立 QA：初审发现 QR 未启用时错误指向普通设置页的 P1；已移除无效入口，改为明确联系店主或系统管理员完成服务配置。
- 可视证据：未生成。预览服务可启动，但 in-app browser 对失败页后的本地导航应用安全阻断，不能访问页面完成真实截图；没有使用旧截图或模拟图替代。
