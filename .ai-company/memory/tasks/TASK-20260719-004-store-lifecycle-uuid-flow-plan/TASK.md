---
schema_version: 1
task_id: "TASK-20260719-004-store-lifecycle-uuid-flow-plan"
title: "店铺生命周期 UUID、关闭与恢复流程"
status: "implementation_complete_release_pending"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["ARCH", "DATA", "FLOW", "UX", "SECURITY", "QA"]
created_at: "2026-07-19T21:49:25Z"
updated_at: "2026-07-20T01:49:00Z"
---
# Task — 店铺生命周期 UUID 与关闭流程完整规划

## Owner request

“这边的停止店铺的uuid是什么，在哪里看；给我完善这个设置，查看项目并完善所有流程以及逻辑，给我写一份完整的规划。”

Plan Delta：Owner 要求流程和页面尽量让小白也能看懂、会操作，并重新规划。

## Business outcome

让 Owner 能清楚识别当前店铺、理解 UUID 尾号来源，并得到可实施的设置页、权限、预检、关闭、切换、恢复、归档、导出、清除、验证与发布完整方案。

## Scope in

- 生产页面只读核对当前店铺 UUID 与尾号。
- Repository、UI、API、auth、SQL、feature flags、测试和运行手册只读审查。
- 完整产品、UX、架构、数据、安全、QA、发布和回滚计划。
- 记录生产关闭前必须解决的硬门禁。

## Scope out

- 对真实店铺执行预检、重命名、关闭、恢复、归档、导出或 purge。
- 开启永久清除、清除排程或后台清除 worker。

## Risk and authority

- T3 / R4 / L1。
- 规划与只读检查可执行。
- Owner 已于 2026-07-20 批准实施、推送与应用；生产店铺 lifecycle mutation 仍不在授权范围。
- 生产 purge 继续 NO-GO。

## Acceptance criteria

- [x] 给出当前完整 UUID、关闭尾号和当前查看位置。
- [x] 解释 UUID 的安全属性与真实安全控制。
- [x] 覆盖完整 UI 状态、权限、API、数据、并发、关闭后上下文、恢复和后台生命周期。
- [x] 给出工作包、测试矩阵、发布顺序、暂停条件和回滚。
- [x] 保存不含不必要 PII 的当前问题截图。
- [x] 将 Owner 可见流程压缩为三步，建立白话词典与渐进展示规则。
- [x] 把重命名移出关闭流程，删除重复的手输店铺名称确认。
- [x] 覆盖初次、通过、阻断、失败、提交中、成功和恢复页面。
- [x] Owner 批准并完成 Must WP-00 至 WP-06 实施。
- [x] 新数据库围栏通过 26 项隔离 schema pgTAP 验证。
- [x] 小白三步关闭、独立重命名、关闭后恢复页和网络未知结果对账已实现。
- [ ] 提交、推送、linked migration、部署与生产只读核验完成后关闭任务。

## Current facts

- ChinaTech UUID：`5248dda1-2b32-46cd-8ed0-d15386a9e8ed`。
- 关闭确认尾号：`86a9e8ed`。
- 完整 UUID 已在 `StoreContext.activeStore.id`，当前 UI 仅以 placeholder/预检摘要露出尾号。
- UUID 展示不需要 migration；suffix 不应持久化。
- 关闭后上下文、原子写入冻结、TOCTOU、capability、worker、hold、审批与 restore proof 是生产硬门禁。

## Departments used

- ARCH/DATA：真实 spawn，只读，输出 UUID 数据链、迁移结论、上下文和后台链缺口。
- FLOW/UX：真实 spawn，只读，输出页面层级、完整状态、权限行为和验收标准。
- SECURITY/QA：真实 spawn，只读，输出威胁模型、BLOCKER、测试矩阵和生产 NO-GO。
- FLOW/UX 第二轮：真实 follow-up，只读，输出小白三步流程、白话文案、五类页面和响应式验收。
- SECURITY/QA 第二轮：真实 follow-up，只读，确认可删除重复店名输入，但尾号、后果确认、MFA 与后台安全门禁不可削弱。

## Canonical deliverable

`docs/STORE_LIFECYCLE_SETTINGS_FLOW_PLAN.md`

## Release boundary

迁移和代码可以在所有 lifecycle flags 关闭时应用；只允许发布和只读核验。生产关闭、恢复、永久清除及开启 mutation/purge flags 仍需独立批准与可牺牲店铺演练。
