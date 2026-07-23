---
schema_version: 1
task_id: "TASK-20260723-006-order-entry-unification"
title: "全站工单入口与详情跳转统一"
status: "closed"
task_class: "T2"
risk_level: "R1"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["Frontend", "QA", "UX"]
created_at: "2026-07-23T20:55:07Z"
updated_at: "2026-07-23T21:21:01Z"
---
# Task — 全站工单入口与详情跳转统一

## Owner request

检查所有其他业务页面进入新建工单和工单详情的入口，以维修工单列表中的共享新建工单弹窗和工单详情弹窗为标准统一跳转，并输出完整入口审计报告。

## Business value

避免客户、概览、利润、全局命令等入口进入不同形态的工单界面，让员工从任意业务页面都回到同一工单工作区完成接单和处理。

## Scope in

- 枚举所有业务页面的新建工单与工单详情入口。
- 为跨模块入口建立统一、可分享、可刷新恢复的工单工作区 URL 意图。
- 工单列表消费 URL 意图并打开现有共享新建/详情弹窗。
- 保留客户与设备预填、创建成功进入详情、关闭后回到工单列表等行为。
- 更新相关单元/E2E 测试并形成入口审计报告。

## Scope out

- Any work not required by the acceptance criteria.
- 不删除 `/orders/new`、`/orders/{id}` 独立页面，它们继续作为深链、移动任务和降级入口。
- 不改变 `/orders/{id}/task` 工作流、客户公开查询或“在新页打开”等明确独立页面语义。
- 不修改订单数据模型、权限、付款、状态机或生产数据。
- 不部署、提交或推送。
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 客户、概览、利润中心、全局命令等跨模块入口统一进入 `/orders` 工单工作区。
- [x] 新建入口打开与工单列表相同的 `NewOrderDialog`，客户/设备预填不丢失。
- [x] 详情入口打开与工单列表桌面行相同的 `OrderDetailScreen surface="dialog"`。
- [x] 创建成功后关闭新建弹窗并在工单工作区打开新工单详情。
- [x] 弹窗关闭后清理意图参数并保留工单列表；刷新含意图 URL 可恢复目标弹窗。
- [x] 独立深链和任务页继续可用，所有刻意保留的例外在报告中说明。
- [x] 390px 与桌面视口无页面级横向溢出，键盘/关闭行为可用。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 工单列表已有共享新建弹窗和详情弹窗 | observed | `order-list-screen.tsx`, `new-order-dialog.tsx` | 作为唯一工作区标准 |
| 多个跨模块入口仍直达独立 `/orders/new` 或 `/orders/{id}` | observed | `rg` 入口清单 | 统一可操作入口；保留明确例外 |
| 独立路由复用相同 Screen，但桌面交互表面不同 | observed | App Router pages | 保留为深链/降级，不作为跨模块普通点击首选 |
| 工作区存在另一任务的未提交改动 | observed | `git status --short` | 不回退；最小补丁兼容重叠文件 |

## Decision and approval points

- R1/L2：可回滚的客户端路由和弹窗状态统一，不涉及数据、权限或生产写入。
- 若发现必须修改付款、状态机、服务端授权或生产配置，停止并重新分类。

## Work packages

- WP1：统一 URL 意图模型与解析测试。
- WP2：工单列表消费意图、弹窗生命周期与创建后详情衔接。
- WP3：替换跨模块入口，保留并记录深链/任务例外。
- WP4：静态、单元、构建和双视口浏览器验证。
- WP5：入口矩阵、残余风险和任务记忆报告。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
