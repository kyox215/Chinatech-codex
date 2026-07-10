---
schema_version: 1
task_id: "TASK-20260710-010-customer-search-mobile-density"
title: "新建工单客户搜索移动端紧凑结果面板"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["UX", "FE", "QA"]
created_at: "2026-07-10T17:24:06Z"
updated_at: "2026-07-10T20:16:14Z"
---
# Task

## Owner Goal

移动端 `/orders/new` 新建维修工单的客户电话搜索结果不能再像窄小弹窗嵌在电话输入区域里。结果需要全宽、紧凑、高密度，符合前台录单时先电话匹配客户和历史设备的操作逻辑。

## Root Cause

上一轮客户搜索 UI 修复留在本地工作树，未随 TASK-009 安全/数据库发布进入 `main`。因此生产 `chinatech.in` 仍显示旧的窄小嵌入面板。

## Scope

- `CustomerIntakeLookup` inline 模式。
- 新建工单客户电话/姓名搜索结果面板布局。
- 一个移动端 E2E 回归，mock 匹配客户和两条历史设备，验证面板全宽和无横向溢出。

## Out Of Scope

- 不改客户搜索 API、数据库、权限或订单创建规则。
- 不提交验证生成的 `next-env.d.ts` 或旧截图副产物。
- 不处理当前主 checkout 里的其他任务残留。

## Result

- inline 搜索结果从字段内部内容列拆出，渲染在字段 shell 下方。
- 匹配客户结果使用全宽紧凑面板，客户信息和历史设备保持高密度展示。
- 新增 E2E 覆盖“有匹配客户”的移动端状态，避免回归成窄小弹窗。
