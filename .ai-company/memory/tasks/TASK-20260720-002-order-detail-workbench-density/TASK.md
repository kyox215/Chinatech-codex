---
schema_version: 1
task_id: "TASK-20260720-002-order-detail-workbench-density"
title: "订单详情桌面工作台整体空间优化"
status: "active"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FE", "UX", "QA", "RELEASE"]
created_at: "2026-07-20T00:30:00+02:00"
updated_at: "2026-07-19T23:24:30Z"
---

# Task

## Owner request

优化整个订单详情桌面页面，不只缩短进度条；所有区域尽量按列和内容宽度组织，避免横向过度拉伸，减少页面下滑，并在完成后推送应用。

## Business outcome

订单详情成为居中的紧凑工作台：高频状态、进度、金额、客户、设备、报价和操作在默认概览中一屏可见；记录、照片和内部成本保持分组访问；现有业务状态、权限、编辑、支付和通知行为不变。

## Scope

- 收窄桌面订单详情弹窗和直达页内容宽度，并限制桌面工作台高度。
- 将进度与金额摘要放在同一顶部区域内，以左右分区呈现。
- 将客户、设备与故障、报价处理改为职责明确、按内容高度排列的三列。
- 收窄设备保管、标签、记录与信息、照片、内部成本和底部操作区。
- 更新加载骨架与桌面布局回归，并提供 1440px 可视证据。
- 通过质量门后推送 `main`，观察 Vercel 部署并执行生产只读烟测。

## Out of scope

- 数据库、Supabase、API、权限、金额计算或工作流状态变化。
- 移动端 RepairOS 页面重构。
- 客户数据或生产数据写入。

## Acceptance criteria

1. 桌面订单详情弹窗不超过 1040px 宽、约 680px 高，并保持视口内可用。
2. 进度区不超过 710px，金额摘要在同一行右侧独立分区。
3. 客户、设备、报价三列不再等比例拉伸，卡片按各自内容高度显示。
4. 设备保管不超过 780px，标签不整行铺满，底部工作区不超过 570px。
5. 记录、照片、内部成本使用较窄内容区，默认概览无纵向溢出。
6. 移动端和所有业务交互保持兼容。
7. agents、lint、typecheck、unit tests、production build、五档桌面布局 E2E 和截图复核通过。
8. 推送后 Vercel 部署 Ready，生产真实订单详情只读烟测通过。

## Risk and approval

- 实施为 R2/L2 可逆 UI 变化；无数据迁移和业务逻辑变化。
- 推送和生产应用为 R3/L2，Owner 已在本任务中明确要求“推送并应用”。
- 若发布门失败、远端 `main` 前移或生产烟测出现关键回归，停止并报告；必要时回滚本次提交。

## Workspace isolation

实施位于 `/private/tmp/repairdesk-order-detail-workbench.7rn7zA`，基于 `origin/main@e1734452`。未改动脏的根工作区，也未覆盖根工作区中另一任务维护的 `ACTIVE_CONTEXT.md`。

## Agent use

No-spawn reason: 本次为单一订单详情 UI 工作面、文件所有权高度重叠，且用户未要求多代理；由主线程作为唯一写入者完成，部门仅 considered / not spawned。
