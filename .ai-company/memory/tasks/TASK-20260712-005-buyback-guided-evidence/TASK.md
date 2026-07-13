---
schema_version: 1
task_id: "TASK-20260712-005-buyback-guided-evidence"
title: "回收小白引导、证件签名与安全成交闭环"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "FE", "FLOW", "INT", "QA", "REL", "SEC", "UX"]
created_at: "2026-07-12T13:06:48Z"
updated_at: "2026-07-13T08:46:28Z"
closed_at: "2026-07-13T08:46:28Z"
---
# Task — 回收小白引导、证件签名与安全成交闭环

## Owner request

回收小白引导、证件签名与安全成交闭环

## Business value

让首次使用系统的门店员工按单一引导完成回收，并安全保存证件、签名、付款与库存记录

## Scope in

- 将回收工作区改为六步引导：选择设备、查看报价、检查手机、登记卖家、拍摄证件并签名、确认成交。
- 按证件类型校验证据要求；护照仅要求资料页。
- 提供真实手写签名板，并把签名绑定到不可变成交摘要与版本。
- 增加回收专用采集、查看和最终成交权限。
- 使用私有受限存储、短期按需读取、读取审计和保留/法律保留字段。
- 新增带 expected version 和 idempotency key 的原子成交 RPC。
- 完成单元、权限、仓储、全量质量门禁及多视口浏览器验证与截图。
- 只提交本任务文件，并安全推送到 origin/main。

## Scope out

- 不执行生产 Supabase migration、数据回填、部署或外部客户通信。
- 不在本轮加入 OCR、NFC、自动证件识别、病毒扫描供应商或法律保留期硬编码。
- 不修改与回收闭环无关的设置中心或其他工作树改动。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 六步引导在移动端和桌面端可完成，单屏一个主任务与主按钮
- [x] 证件要求按类型变化，真实签名绑定成交摘要，修改关键字段后签名失效
- [x] 回收成交具备独立权限、服务端门禁、幂等与原子数据库提交
- [x] 证件与签名使用私有受限存储、短期按需读取、审计和保留字段
- [x] 相关测试、全量 lint/typecheck/test/build、多视口浏览器流程与截图通过
- [x] 范围提交安全推送 origin/main，不执行生产数据库迁移或部署

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| 基线 | observed | origin/main a76852f61b09 | isolated worktree created |
| 当前成交保存 | observed | buyback workspace + inventory repository | 串行多请求、非原子、非幂等 |
| 现有附件 | observed | inventory attachments migration/repository | 私有但证件和普通附件同域，URL 自动签发 1 小时 |
| 生产 schema/bucket 状态 | unknown | 未连接生产数据库 | 本任务不应用生产迁移 |
| 正式保留期限 | decision required | 法律/老板确认 | 只提供 nullable retention/legal-hold 字段，不猜测期限 |

## Decision and approval points

- R3 / L2：可实施和验证代码；生产迁移、部署、破坏性操作继续需要老板单独批准。
- 默认角色：Sales 只登记卖家基础资料和声明并提交负责人；Owner/Manager 可采集、查看受限证据并最终成交；Technician/Viewer 均不可。
- 证件号码只保存 last4/掩码；不保存完整号码到 notes、legacy payload、日志或浏览器持久化。

## Work packages

- WP-00：隔离工作树、任务合同、回滚边界。
- WP-01：权限、受限证据模型、短期按需访问与审计。
- WP-02：原子幂等成交 RPC、仓储/API/mock 契约。
- WP-03：六步引导、证件采集、签名绑定、成功页。
- WP-04：单元/权限/安全/全量/浏览器六视口验证。
- WP-05：独立复核、记忆收尾、范围提交并推送 main。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
