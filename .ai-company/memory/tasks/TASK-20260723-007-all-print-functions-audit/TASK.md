---
schema_version: 1
task_id: "TASK-20260723-007-all-print-functions-audit"
title: "全站打印功能可用性审计"
status: "closed"
task_class: "T2"
risk_level: "R1"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["QA", "Frontend", "Product"]
created_at: "2026-07-23T21:34:17Z"
updated_at: "2026-07-23T21:49:03Z"
---
# Task — 全站打印功能可用性审计

## Owner request

检查所有打印功能是否能正常打开浏览器打印预览并输出正确内容，只做检查和报告，不修改打印业务逻辑。

## Business value

避免门店在交付工单、回收设备或销售库存时，遇到按钮可见但无法打开打印、权限或资料门槛不清楚、打印内容不完整或被浏览器裁切的问题。

## Scope in

- 工单列表单张打印与批量打印。
- 工单详情页和工单任务页的客户工单打印。
- 回收成交完成页的回收凭据打印。
- 已售库存商品的保修票据打印。
- 公共打印生命周期、门店资料、权限、二维码签发、打印媒体样式及 Safari/WebKit 风险。
- 自动化能够覆盖的预览打开、打印调用和打印布局验证；输出审计报告与可视证据。

## Scope out

- 修复或重构打印业务代码。
- 真实物理打印机、耗材、驱动或操作系统打印机配置验证。
- 生产数据写入、生产部署或客户沟通。
- 旧版未被 Next.js App Router 使用的遗留路由实现，除非仍能从当前产品页面到达。
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 审计和报告可执行；任何打印逻辑修复需作为后续任务单独批准。

## Acceptance criteria

- [x] 枚举当前产品所有可到达的打印入口，并记录页面、按钮、前置条件和权限。
- [x] 检查每个入口是否会准备专用打印内容并触发浏览器打印调用。
- [x] 检查工单打印的单张、批量、详情、任务页，以及二维码签发和作废工单阻断。
- [x] 检查回收凭据与库存保修票据的内容隔离、门店身份和打印媒体布局。
- [x] 运行相关单元测试、静态检查和可用的 Chromium/WebKit 浏览器验证。
- [x] 对不能由自动化证明的 Safari 原生预览和物理打印限制做显式说明。
- [x] 输出 PASS / CONDITIONAL / FAIL 结果矩阵、问题级别、证据和建议，不修改打印业务逻辑。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |
| Current product has four reachable print surfaces | observed | `src/app`, feature screens and print components | verify each surface |
| Physical printer cannot be automated in this workspace | constraint | environment capability | report as residual manual gate |
| Owner previously supplied Safari clipping evidence | observed | owner screenshot in task context | compare with current WebKit/CSS evidence |

## Decision and approval points

- R1 / L2: read-only functional audit plus task-local report writes; no production or business-code mutation.
- No subagents: owner did not request delegation and current multi-agent policy forbids proactive spawning; the main thread performs the bounded read-only audit.

## Work packages

- WP1 — inventory all reachable print entries and gates.
- WP2 — static review of lifecycle, permissions, data preparation and print CSS.
- WP3 — targeted tests plus Chromium/WebKit runtime verification where possible.
- WP4 — evidence-backed report, visual evidence, checkpoint and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
