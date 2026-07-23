---
schema_version: 1
task_id: "TASK-20260723-004-startup-bootstrap-print-implementation"
title: "启动性能方案B与打印可用性实施"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "DOC", "FE", "QA", "SEC"]
created_at: "2026-07-23T20:11:40Z"
updated_at: "2026-07-23T22:02:56Z"
closed_at: "2026-07-23T22:02:56Z"
---
# Task — 启动性能方案B与打印可用性实施

## Owner request

启动性能方案B与打印可用性实施

## Business value

缩短概览、工单、客户首屏等待并恢复经理单张打印与明确诊断

## Scope in

- 合并 Shell 冷启动的 onboarding、store context 与 AI capability 请求。
- 停止首屏主数据完成前的跨业务预加载争抢，并使用订单队列摘要预热。
- 按角色拆分单张打印与批量打印/导出能力。
- 为 QR、店铺输出资料和作废工单提供准确禁用原因及恢复入口。
- 保持旧服务端端点兼容，并验证授权失败时 fail closed。

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 冷启动主数据完成前不触发无关跨业务预加载
- [x] Shell 启动合并为一次 actor 解析且保持旧接口兼容
- [x] Manager 可单张打印但不可批量打印或导出
- [x] 打印禁用显示准确原因与恢复入口
- [x] lint、typecheck、test、build 与浏览器验收通过

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |

## Decision and approval points

- Owner selected option B. Implementation stayed L2/local; no production deploy, database migration, secret or dependency change occurred.
- Home-route cross-domain preload is suppressed rather than deferred. This prioritizes first-screen stability; revisit only with measured navigation regressions.

## Work packages

- Shell bootstrap/API compatibility and tenant cache isolation.
- Lazy mounting and home preload coordination.
- Print permission projection, readiness diagnostics and recovery UI.
- Documentation, automated gates, local browser evidence and independent QA.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
