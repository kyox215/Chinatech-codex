---
schema_version: 1
task_id: "TASK-20260712-003-overview-quick-entry-design"
title: "概览页快速接单与快速回收报价入口"
status: "in_progress"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "FLOW", "UX", "FE", "QA"]
created_at: "2026-07-12T01:10:40Z"
updated_at: "2026-07-12T03:45:32Z"
---
# Task

## Owner goal

在概览页增加“快速接单”和“快速回收报价”两个直观入口，让第一次使用系统的门店人员无需理解模块结构即可开始核心业务；完成验证后推送 `main`。

## Scope in

- 移动端把双入口放在“今日优先级”之前。
- 平板/桌面把原单一“进入工单”替换为两个明确按钮。
- 复用 `/orders/new` 与 `/buyback?new=1` 正式流程。
- 修正概览统计加载和全失败时的假零、假空态与假低风险结论。
- 增加单元、响应式 E2E、错误态与截图证据。

## Scope out

- 不修改接单或回收业务规则、价格算法、权限矩阵、API、数据库、迁移或生产数据。
- 不新增“一键创建”或缩短版业务表单。
- 不部署生产；用户只授权提交并推送 `main`。
- 不混入原工作区或 `TASK-20260712-002-mobile-interaction-click-reliability` 的并发改动。

## Change contract

- 单一业务代码写入者：Integration Lead。
- 隔离工作树：`/private/tmp/repairdesk-overview-003-20260712`。
- 分支：`codex/overview-quick-entry-20260712`；最初基于 `77e7410e524b`，发布前已重放到 `origin/main@f34ef2d293b6`。
- 允许文件：Dashboard screen/work-insight/test、新 dashboard E2E、本任务记忆和精选截图。
- 子 Agent 只读复核，不暂存、提交、推送或部署。

## Acceptance criteria

1. “快速接单”精确进入 `/orders/new`，点击入口本身不写数据。
2. “快速回收报价”精确进入 `/buyback?new=1` 并打开“回收报价”工作区。
3. 390/430 首屏双入口位于“今日优先级”之前；768 起只显示桌面双按钮。
4. 390、430、768、1024、1440 都只有一组可见入口且无页面级横向溢出。
5. 加载期间显示骨架/破折号，不显示“开始第一笔业务”等确认空态。
6. Summary/Queue 全失败时显示准确错误与重试，不显示“风险较低”或 `0 单` 结论。
7. `agents:check`、lint、typecheck、全量 test、build 和新 Playwright 全部通过后才可推送。
8. 生成移动/桌面最终截图，提交前刷新 `origin/main`，只暂存任务文件。

## Rollback

回滚本任务单一提交即可恢复原概览入口与空态文案；没有数据或迁移回滚。

## Current state

业务实现、错误态修正、独立 UX/FE 复核、7 项 Playwright、两张最终截图和全量门禁已完成。并发的员工权限任务已合并，财务脱敏与“待处理”口径均保留；范围化提交和推送仍在进行。
