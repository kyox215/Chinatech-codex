---
schema_version: 1
task_id: "TASK-20260721-005-new-order-blank-name-safari-transition"
title: "新客户姓名可空与Safari建单后流转修复"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "FE", "FLOW", "QA"]
created_at: "2026-07-21T15:46:35Z"
updated_at: "2026-07-21T16:09:25Z"
closed_at: "2026-07-21T16:09:25Z"
---
# Task — 新客户姓名可空与Safari建单后流转修复

## Owner request

新客户姓名可空与Safari建单后流转修复

## Business value

允许未知姓名客户快速建单，并消除Safari建单后需刷新才能流转的操作中断

## Scope in

- Allow a new customer record to keep an empty display name during atomic order creation.
- Synchronize store-scoped workflow/options/detail caches before navigating to a newly created order.
- Add database, unit, and WebKit regression coverage.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 新客户姓名留空时在线建单成功，服务端与数据库原子创建规则一致
- [x] Safari兼容路径中建单跳转详情后无需刷新即可读取流转动作并成功更新状态
- [x] 不放宽手机号、设备、故障和状态权限校验，不影响已有客户选择
- [x] 相关单元/集成测试、lint、typecheck和build通过；可视验证或明确环境阻塞

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Frontend name field was already optional | observed | `new-order-customer-device-section.tsx`, `new-order-form.ts` | no UI validation change required |
| Blank name was rejected only by the deployed atomic create function | observed | `20260721114549_order_customer_identity_atomic_create.sql` | removed by forward migration |
| New-order navigation did not await scoped cache invalidation | observed | `new-order-screen.tsx` before patch | fixed and covered by WebKit |

## Decision and approval points

- R2/L2 minimal compatible change. Production migration and deployment follow the owner's prior explicit deploy instruction.

## Work packages

- Single writer: IntegrationLead.
- No-spawn reason: this is a narrow, sequential database-plus-navigation fix; the active collaboration policy forbids unrequested sub-agents.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
