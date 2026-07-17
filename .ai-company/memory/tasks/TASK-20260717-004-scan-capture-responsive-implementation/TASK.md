---
schema_version: 1
task_id: "TASK-20260717-004-scan-capture-responsive-implementation"
title: "扫码、拍照与新建工单响应式优化实施"
status: "closed"
task_class: "T3"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["Architecture", "Frontend", "Product", "QA", "Release", "Security", "UX"]
created_at: "2026-07-17T18:40:26Z"
updated_at: "2026-07-17T19:31:07Z"
---
# Task — 扫码、拍照与新建工单响应式优化实施

## Owner request

扫码、拍照与新建工单响应式优化实施

## Business value

落实已完成扫码/拍照/新建工单响应式优化计划，先修复相机生命周期、扫码结果安全和移动/桌面关键体验，降低扫码失效、摄像头泄漏、URL 暴露和切页丢失风险。

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

- [x] 全局扫码关闭、切页、后台、迟到启动和重复回调不会保留摄像头或触发重复结果。
- [x] 扫码解析只接受当前 origin/允许来源的内部链接，外部链接不会伪装成内部跳转。
- [x] 全局扫码搜索不再把原始扫码内容写进 URL query；使用一次性内存 Scan Intent 或等价短生命周期机制。
- [x] 新建工单移动端恢复可打开主菜单的入口，并保持桌面端布局不退化。
- [x] 相关单元/组件测试通过；若 UI 运行环境允许，提供移动/桌面截图证据。
- [x] 本任务不引入数据库变更；若验证发现必须迁移，先形成 Supabase 安全批准包。

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
