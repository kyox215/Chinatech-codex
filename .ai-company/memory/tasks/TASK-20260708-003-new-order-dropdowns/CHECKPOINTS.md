# Checkpoints — TASK-20260708-003-new-order-dropdowns

## 2026-07-07T22:31:36Z — Task created

- **Phase:** intake
- **Completed:** task directory and initial metadata created.
- **Evidence:** owner request; generated task files.
- **Decisions:** none.
- **Risks/blockers:** scope and project facts not yet verified.
- **Next:** run `$company-task-intake`, `$context-rehydrate`, and `$risk-autonomy-classify`.
## 2026-07-07T22:31:48Z — 新建维修订单下拉交互已修复：品牌/型号由原生 datalist 改为可点击 DropdownMenu 触发器并保留输入；Select 与 DropdownMenu 弹层提升到 z-[90]；报价服务区保修、留存、类型、状态触发器统一为 40px 高、圆角和间距更一致。

- **Phase:** verified_local_preview
- **Completed/current state:** 新建维修订单下拉交互已修复：品牌/型号由原生 datalist 改为可点击 DropdownMenu 触发器并保留输入；Select 与 DropdownMenu 弹层提升到 z-[90]；报价服务区保修、留存、类型、状态触发器统一为 40px 高、圆角和间距更一致。
- **Next:** 如继续此任务，先查看 src/features/orders/forms/new-order-customer-device-section.tsx、src/features/orders/forms/new-order-quotation-section.tsx、src/components/ui/select.tsx、src/components/ui/dropdown-menu.tsx；本地截图在 screenshots/TASK-20260708-003-new-order-dropdowns/new-order-dropdowns-fixed.png。
- **Decision:** 保留品牌/型号手动输入能力，同时把箭头改成真实菜单；通过全局基础 Select/Dropdown z-index 提升避免弹窗内菜单被其它层级遮挡；服务区用可选 triggerClassName/contentClassName 做局部尺寸优化。
- **Evidence:**
  - npx eslint targeted pass; npm run typecheck pass; git diff --check pass; browser verified brand/model/fault/accessory/type/status dropdowns open/select with z=90; screenshot new-order-dropdowns-fixed.png captured.
- **Recorded by:** CEO-Orchestrator
