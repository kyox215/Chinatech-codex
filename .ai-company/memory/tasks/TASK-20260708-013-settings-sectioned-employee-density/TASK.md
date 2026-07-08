---
schema_version: 1
task_id: "TASK-20260708-013-settings-sectioned-employee-density"
title: "设置页分组切换与员工管理高密度改版"
status: "review"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["Frontend", "UX", "QA"]
created_at: "2026-07-08T20:34:30Z"
updated_at: "2026-07-08T21:37:50Z"
---
# Task — 设置页分组切换与员工管理高密度改版

## Owner Request

设置目标并开始执行计划，启用子代理分工。将设置页改为一行分组导航点击切换页面，并把员工管理区优化为桌面高密度、移动紧凑布局，UI 框架对齐，所见即所得。

## Business Value

让 Chinatech 店铺负责人在设置页按功能快速定位账号、店铺、员工、通知打印、默认规则和状态流；员工管理可以一屏查看成员、邀请、申请和角色状态，降低日常管理成本。

## Scope In

- `/settings` 分组导航与 URL section 状态。
- 设置内容按账号、店铺、员工、通知与打印、默认规则、状态流分组展示。
- 员工管理区桌面高密度信息布局与移动端紧凑列表。
- 保留现有设置保存、店铺切换、员工邀请、邀请码、加入申请审批、状态流管理能力。
- 运行相关自动化和桌面/移动可视验证。

## Scope Out

- 不改数据库结构。
- 不改员工权限核心服务端规则。
- 不做 owner 转让、最后 owner 保护等新权限产品能力。
- 不自动生产部署，除非 Owner 后续明确要求。

## Constraints

- 主线程为唯一业务代码写入者。
- 子代理只读。
- 不覆盖工作区中与本任务无关的大量既有改动。
- 前端数据访问继续使用 `@/lib/repairdesk/api`。
- 新 UI 遵守 RepairOS 响应式与高密度布局规则。

## Acceptance Criteria

- 设置页有清晰的一行分组导航，点击切换当前分组。
- URL 能表达当前分组，刷新后保持分组。
- 员工管理分组显示统计、搜索/筛选入口、邀请工具、成员列表、邀请/申请状态。
- 桌面端信息紧凑对齐；移动端不出现页面级横向滚动。
- 加载、空、错误、无权限和长邮箱状态可读。
- 现有 mutation 功能不回退。

## Agent Plan

- Project Explorer: 只读确认代码路径、数据流和最小改造点。
- UX Reviewer: 只读给出分组导航、员工区响应式和状态规范。
- QA Reviewer: 只读给出验证矩阵、截图要求和阻断条件。

## Test Plan

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 桌面与移动 `/settings?section=members` 截图和横向溢出检查。

## Rollback Plan

回滚本任务涉及的设置页和任务记忆文件改动；不触碰其他现有脏工作区改动。
