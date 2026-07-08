# Checkpoints — TASK-20260708-004-workspace-dialog-sizing

## 2026-07-07T22:42:09Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T22:42:22Z — 统一工作台型 Dialog 尺寸：componentOverlay/detailWorkspace 和 orderDetailWorkspace 现在与新建订单使用相同桌面宽度逻辑，订单详情入口移除旧 56px/1000px 覆盖，legacy orders route 同步，响应式文档记录小型 Dialog 不跟随全屏工作台。

- **Phase:** verified_local_preview
- **Completed/current state:** 统一工作台型 Dialog 尺寸：componentOverlay/detailWorkspace 和 orderDetailWorkspace 现在与新建订单使用相同桌面宽度逻辑，订单详情入口移除旧 56px/1000px 覆盖，legacy orders route 同步，响应式文档记录小型 Dialog 不跟随全屏工作台。
- **Next:** 如继续扩展到库存或平台大型工作台弹窗，先确认它们是否属于 workspace shell；小型收款、通知、确认 Dialog 继续保持 modal/formContent。
- **Decision:** 采用共享 workspace shell 统一订单详情和客户详情预览尺寸，避免每个入口散落单独宽高覆盖；不扩大小型业务表单弹窗。
- **Evidence:**
  - npx eslint src/lib/component-patterns.ts src/lib/ui-patterns.ts src/features/orders/screens/order-list-screen.tsx src/routes/orders.index.tsx exit 0; npm run typecheck exit 0; git diff --check targeted files exit 0; browser order detail 1440x900 dialog 1400x868 overflowX false; browser customer detail 1440x900 dialog 1400x868 overflowX false; screenshots/TASK-20260708-004-workspace-dialog-sizing/order-detail-workspace-1440.png; screenshots/TASK-20260708-004-workspace-dialog-sizing/customer-detail-workspace-1440.png
- **Recorded by:** CEO-Orchestrator
