---
schema_version: 1
task_id: "TASK-20260717-001-overlay-close-safe-layout"
title: "关闭按钮不遮挡内容的桌面与移动端优化"
status: "verified"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["UX", "Frontend", "QA", "Release"]
created_at: "2026-07-17T17:52:00Z"
updated_at: "2026-07-17T18:25:00Z"
---
# Task — 关闭按钮不遮挡内容的桌面与移动端优化

## Owner Request

老板提供截图指出关闭按钮遮挡页面信息，要求检查所有项目相关组件并优化电脑端和移动端，确保关闭按钮不遮挡内容；计划已批准，完成后推送并应用 main。

## Business Value

提高工单详情、客户详情和通用弹层在桌面与移动端的可读性，避免关闭按钮压住状态、标题、下一步或业务操作，保证前台高频弹窗处理不中断。

## Scope In

- Dialog / Sheet header 关闭按钮安全区。
- 工单详情弹窗、加载骨架和错误态关闭按钮布局。
- 客户详情预览弹窗关闭按钮布局。
- 桌面与移动端的静态检查、类型/测试验证和截图证据。
- 推送 main 前的发布边界记录。

## Scope Out

- 数据库、API、权限、付款、客户通知、生产数据迁移。
- 当前主工作区已有未提交的创建工单幂等/卡顿恢复改动。
- 无关视觉重构、配色重做或页面结构重写。

## Acceptance Criteria

- [x] 工单详情弹窗关闭按钮不再绝对定位遮挡 Hero 信息。
- [x] 工单详情加载和错误状态保留可见关闭入口且不遮挡内容。
- [x] 客户详情预览关闭按钮在业务头部操作区，不使用覆盖内容的默认浮动关闭按钮。
- [x] 通用 Dialog / Sheet header 为默认关闭按钮保留右侧安全空间。
- [x] 桌面与移动端常用 viewport 无页面级横向溢出，相关截图归档。
- [x] `npm run lint`、`npm run typecheck`、相关测试和 `npm run build` 已运行或记录无法运行原因。
- [x] 仅提交本任务 scoped diff，不混入当前主工作区旧改动。

## Risk Classification

R1 / L2. 这是可逆 UI 布局修复，不改变数据合同、权限、付款、生产数据库或外部通信。推送 main 是发布边界，需在验证后执行并记录真实结果。
