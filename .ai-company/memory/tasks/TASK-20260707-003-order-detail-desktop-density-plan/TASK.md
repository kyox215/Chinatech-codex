---
schema_version: 1
task_id: "TASK-20260707-003-order-detail-desktop-density-plan"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "Integration Lead"
created_at: "2026-07-07T15:25:53+02:00"
closed_at: "2026-07-07T15:25:53+02:00"
updated_at: "2026-07-07T13:26:28Z"
---
# Task

## Owner Goal

老板指出 `/orders` 工单详情弹窗在电脑端显示效果不理想，很多内容只是响应式拉伸，设备照片等区域被拉长。要求重新规划每个布局，形成合理大小、直观清楚、高密度、紧凑的 UI 计划书。

## Business Value

维修店电脑端需要快速查单、改单、收款、看照片和追溯记录。高密度桌面工作台可以减少滚动和视觉浪费，提高前台和技师处理效率。

## In Scope

- 桌面端工单详情 Dialog 布局规划。
- 1024、1280、1440、1536 宽度下的布局策略。
- 客户、设备故障、报价、照片、记录、底部动作的尺寸和信息优先级。
- 后续实现工作包和验收清单。

## Out of Scope

- 本次不改业务组件代码。
- 不改数据库、API、订单状态机、付款规则或通知规则。
- 不重设计移动端 RepairOS Floating Card。

## Evidence

- 用户提供的 Chrome appshot 显示 `/orders` 工单详情 Dialog 中客户、设备、报价和设备照片区域在桌面端被拉伸。
- 当前项目规则要求工单详情 Dialog 是固定沉浸式工作面，主概览三列同屏并避免页面级横向滚动。
- 当前代码中 `componentOverlay.detailWorkspace` 对 `xl/2xl` 放宽到更大宽度，可能导致宽屏下卡片继续拉伸。

## Deliverables

- `docs/ORDER_DETAIL_DESKTOP_DENSITY_UI_PLAN.md`

## No-Spawn Reason

本任务是单一页面的 UI 规划文档，不涉及并行代码写入、数据/API/权限变更，也没有老板明确要求多代理或部门执行。主线程按 UX skill 完成即可。

## Verification

- 文档已创建。
- 收尾前需检查 scoped diff。
- 本任务为规划文档，无新增运行页面截图；可视依据来自老板提供的当前页面截图和仓库已有订单详情截图。
