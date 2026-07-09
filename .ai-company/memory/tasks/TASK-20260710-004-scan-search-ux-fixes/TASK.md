---
schema_version: 1
task_id: "TASK-20260710-004-scan-search-ux-fixes"
title: "扫码查询移动端 UX 修复并推送 main"
status: "closed"
task_class: "T1"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["FE", "FLOW", "QA", "RELEASE", "UX"]
created_at: "2026-07-09T22:32:15Z"
updated_at: "2026-07-09T22:46:16Z"
closed_at: "2026-07-09T22:46:16Z"
---
# Task — 扫码查询移动端 UX 修复并推送 main

## Owner request

扫码查询移动端 UX 修复并推送 main

## Business value

提升订单、客户、回收、库存扫码查询在手机和桌面的可用性，减少扫码后看不到动作、错误提示不清晰、深链无反馈的问题

## Scope in

- To be refined by `$company-task-intake`.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [ ] 扫码 Sheet 在移动端结果态动作可见且可滚动
- [ ] 客户、回收、库存移动搜索行扫码入口触控尺寸与订单页一致
- [ ] 摄像头不可用错误为中文可操作提示
- [ ] 库存 item 深链找不到记录时回填搜索并给出可见提示
- [ ] 相关单元测试、本地构建/类型检查和浏览器截图验证完成

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- None registered yet. Run `$risk-autonomy-classify`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
