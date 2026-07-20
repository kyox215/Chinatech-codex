---
schema_version: 1
task_id: "TASK-20260720-002-print-safari-reliability-fixes"
title: "打印与 Safari 快速接单可靠性修复发布"
status: "in_progress"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["FLOW", "UX", "FE", "QA", "SEC", "INT"]
created_at: "2026-07-20T13:16:04Z"
updated_at: "2026-07-20T13:39:00Z"
---

# Owner goal

按照 `TASK-20260720-001-print-safari-audit` 报告修复全部相关打印和 Safari 快速接单缺陷，完成验证后推送 `main` 并应用到生产。

# Business value

- 恢复客户纸质工单的完整性，防止后台操作区进入预览和实物纸张。
- 保证前台连续接单不会被退出中的遮罩、pointer lock、静默导航或旧会话状态阻断。
- 将真实打印媒体、WebKit 重复点击和生产冒烟升级为可重复门禁。

# Context packet

## Verified

- 当前实施基线是 fetch 后的 `origin/main`：`0a0ec0f5a7b3aa4fc992977da172732576686379`。
- 原工作区大量 dirty 且本地 `main` 分叉；实施在 `/private/tmp/repairdesk-print-safari-fix-20260720` 的隔离分支 `codex/print-safari-fix-20260720` 进行。
- 打印根因是 layered `display: contents !important` 覆盖未分层打印隐藏规则。
- dirty guard 放弃后立即二次点击可被 closing AlertDialog overlay/body pointer lock 吞掉。
- `origin/main` 已含 `3022ba83`，列表弹窗创建后进入 canonical 详情路由。

## Proposed

- 采用最小兼容方案：同层打印隔离、共享打印生命周期、正式任务页票据、移除客户联内部任务入口、无静默裁切；统一接单动作/会话、可观察导航结果、参数键驱动预填和 overlay teardown。

## Unknowns to verify

- 长工单在 WebKit/Chromium 中的实际分页边界。
- 真实 Safari 原生预览和店内 HP 打印机结果只能在部署后由真实设备完成最终物理门禁。

## Conflicts

- 原工作区已有无关改动，禁止 stage、reset、clean 或混入发布。
- `ACTIVE_CONTEXT` 指向另一项已规划任务；本实施使用独立 task memory，不覆盖其上下文。

# Scope

## In scope

- PrintPortal、全局打印 CSS、订单详情/列表/任务页/库存打印入口。
- 半页标准、长内容、客户/内部链接边界、打印 prepare/cleanup 生命周期。
- Dashboard/列表/命令面板/移动快捷栏的新接单入口合同。
- NavigationGuard outcome、错误反馈、overlay teardown、same-route session、query prefill。
- 单元、Playwright Chromium/WebKit、PDF/截图、完整质量门禁、Git main、Vercel 生产验证。

## Out of scope

- 数据库 schema、迁移、生产数据写入。
- 付款、订单状态、权限矩阵或依赖升级。
- 真实客户 PII 测试。

# Risk and authority

- **R3:** 客户输出与核心接单流程跨模块变更，并包含生产发布；无数据库写入，代码回滚可通过单一发布提交完成。
- **L2:** 可自主实施、测试、提交；Owner 本条指令已明确批准 push 与生产应用，满足本任务 D3 发布批准。
- **Serialized release:** 只有 Integration Lead 执行 stage/commit/push/deploy；子 Agent 全部只读。
- **Stop conditions:** 打印仍泄漏/裁切、WebKit 二次点击失败、权限边界不清、质量门禁失败、远端 main 前进导致非快进、生产部署非 READY 或 smoke/log 出现阻断错误。

# Acceptance criteria

- 打印媒体下应用 shell、AppBar、Sidebar、ActionDock、Toast、Dialog/Sheet 不可见，正式票据可见。
- 标准单工单 A4 竖向预览为 1 页、内容在上半页；长内容不静默裁切。
- 订单任务页打印正式客户票据；客户联不再包含内部任务 QR/链接；打印取消/重复/卸载可清理。
- 首页首次进入、返回后二次进入、dirty 放弃后立即二次点击在 Chromium/WebKit 390/1440 可用。
- 所有新接单入口共享明确 session；相同路由不再静默无效果；query 参数变化可重新预填且旧异步结果不覆盖新参数。
- 导航调用方可区分 accepted/prompted/ignored/failed，失败有可见反馈，不吞异常。
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build` 通过；任务相关 E2E/PDF/截图通过独立 QA。
- scoped commit 推送 `origin/main`；对应 Vercel 部署到 READY，生产 URL smoke 与错误日志检查通过。

# Agent plan

- `/root/print_fix_review`: FE/Architecture/UX, read_only, print implementation package.
- `/root/intake_fix_review`: FLOW/FE/UX, read_only, intake state/interaction package.
- `/root/release_security_qa`: QA/SEC/Release, read_only, threat model and release gate; post-implementation re-review.
- Integration Lead: only business-code writer and release executor.

# Visual evidence

- Generate synthetic-data Chromium/WebKit screenshots for Dashboard second-entry and print-media/PDF output.
- Production smoke screenshots must avoid customer PII and credentials.
- Final physical Safari/HP evidence is a post-deploy Owner/device gate if local automation cannot operate the real printer dialog.
