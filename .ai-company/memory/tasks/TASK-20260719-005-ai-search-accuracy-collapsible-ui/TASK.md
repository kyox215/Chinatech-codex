---
schema_version: 1
task_id: "TASK-20260719-005-ai-search-accuracy-collapsible-ui"
title: "修复大模型工单搜索准确性并折叠 AI 助手辅助区域后发布"
status: "closed"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L1"
owner: "IntegrationLead"
departments:
  - product
  - architecture
  - frontend
  - backend
  - security
  - qa
  - release
  - documentation
created_at: "2026-07-19T12:14:12Z"
updated_at: "2026-07-19T13:15:00Z"
closed_at: "2026-07-19T13:14:41Z"
---
# Task — 修复大模型工单搜索准确性并折叠 AI 助手辅助区域后发布

## Owner request

检查并修复大模型工单搜索不准确的问题；把对话上方的用量、下方的处理方式与说明改为可收纳、可折叠；先完成规划，再实施、推送并部署应用。

### Owner release approval — 2026-07-19

“執行完成後推送一並應用。”该原文批准本任务完成验收后执行 scoped commit、非强制推送 `main` 和生产应用部署。它不批准数据库 migration、密钥、模型、预算、AI allowlist、外发范围或生产数据变更。

## Business value

设备型号查询只返回与用户原句一致的当前门店工单，避免把 Samsung 等无关设备误报为 Apple iPhone；同时在移动端把非核心信息收纳起来，优先保留结果和输入空间。

## Scope in

- 复现并记录“有没有苹果15系列的单子”在大模型模式下可能退化为无设备约束的根因。
- 扩展受控设备意图解析，覆盖常见中文自然问法，同时保持品牌和型号联合约束。
- 大模型完成规划后，由服务端根据用户原句执行确定性语义校验与约束合并；模型不能移除或替换已识别的设备条件。
- 设备查询结果执行防御性相关性校验，阻止不匹配卡片被返回。
- 提示词/策略版本、单元测试、服务测试及 E2E 回归同步更新。
- 对话顶部今日用量改为默认收起的一行摘要，可展开查看三项明细及预留费用。
- 对话底部处理方式改为默认收起的一行当前选择，可展开切换本地/大模型并查看隐私与语音说明。
- 完成 390px 与桌面可视验证、全量门禁、精确提交、推送、生产部署与冒烟。

## Scope out

- 不改变 OpenAI 模型、现有密钥、价格、预算、配额、allowlist 或外发审批。
- 不新增数据库表、字段、RLS、RPC 或 migration，不修改生产数据。
- 不把本地规则替换成全文模糊搜索，不允许客户端指定门店或服务端筛选器。
- 不重做 AI 助手整体视觉、导航或订单列表。
- 不修改与本任务无关的用户工作区变更。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 根工作区存在无关改动；所有写入、提交和验证只在隔离 worktree 进行。
- 大模型仍必须经过现有出站、用量、预算、安全标识和审计链路。
- 折叠不能隐藏当前处理方式；隐私说明必须可键盘访问并可重新展开。
- 发布只允许 exact-SHA、非强制推送；部署失败时回滚到发布前 `main` 对应 READY 部署。

## Acceptance criteria

- [x] “有没有苹果15系列的单子”可解析为带品牌/型号的设备约束，不能退化为无筛选查询。
- [x] 大模型返回空设备条件、宽泛 `search=15` 或冲突设备时，服务端以用户原句的可信设备约束校正查询。
- [x] Apple/iPhone 15 查询结果中不出现 Samsung A12/A52；结果数量与卡片均来自受约束查询。
- [x] 非设备自由文本、订单号、金额复核和权限路径不受回归影响；未知意图继续澄清或使用既有模型规划。
- [x] 顶部用量默认收起且一行可读；展开后请求/上限、Token、费用及预留状态仍完整。
- [x] 底部处理方式默认收起且当前模式始终可见；展开后可切换模式，并能阅读对应隐私/语音说明。
- [x] 折叠触发器具备正确的按钮语义、`aria-expanded` 状态、键盘操作与不小于 44px 的移动触达区。
- [x] 390px 与桌面无横向溢出，收起状态明显释放结果和输入空间。
- [x] 相关 Vitest、Lint、TypeScript、全量测试、生产 build 与目标 Playwright 通过。
- [x] 任务截图覆盖 390px 收起/展开状态和准确的 Apple 15 结果；不暴露秘密或完整客户 PII。
- [x] exact business commit `d9c86ac1` 非强制推送到 `origin/main`；READY 部署 `dpl_4k8Jt4wCwCErZqz4m4SN9rfo5xEf` 的 Git SHA 完全一致，两个生产域名与匿名安全冒烟通过。

## Facts, assumptions, and unknowns

| Item                                                              | Type                | Evidence                                 | Status / next action                                                     |
| ----------------------------------------------------------------- | ------------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 截图中的模型查询返回 476 条且首项为 Samsung A52                   | observed            | Owner screenshot 2026-07-19              | reproduced through code path analysis                                    |
| `parseDeviceSearchIntent("有没有苹果15系列的单子")` 基线返回 null | observed baseline   | `order-device-search.ts` grammar         | fixed and covered by parser/router/model-mode tests                      |
| 显式 model 模式跳过 deterministic plan                            | observed            | `order-assistant.service.ts`             | preserve provider call but reconcile trusted device constraint afterward |
| Provider tool output仅做结构校验                                  | observed            | Zod tool-call parse                      | add semantic guard before repository query                               |
| Repository `deviceSearch` 已能严格排除 Samsung                    | observed            | repository implementation/test           | reuse instead of adding data-layer search behavior                       |
| 折叠默认状态                                                      | decision            | owner mobile-space complaint             | collapsed by default on every new store/sheet session                    |
| 现有生产密钥                                                      | approved constraint | earlier owner instruction “复用现有密钥” | reuse server configuration; do not expose or change                      |

## Decision and approval points

- Local implementation and verification: R3 / L2 / D2, reversible code only.
- Production push/deploy: R3 / L1 / D4, explicitly approved by Owner in this task.
- Any migration, secret/model/budget/allowlist/external-data-scope change requires a new Owner decision and is outside this task.

## Work packages

1. WP-01 root cause, product rules, architecture and responsive interaction contract.
2. WP-02 trusted device intent parsing and model-plan reconciliation.
3. WP-03 defensive result relevance guard and regression coverage.
4. WP-04 collapsible usage and processing/help UI with accessibility coverage.
5. WP-05 related tests, full gates, Playwright and visual evidence.
6. WP-06 integration lease, exact-SHA push/deploy, production smoke and rollback readiness.

## Definition of done

- Acceptance criteria are backed by tests, screenshots and production evidence.
- Required architecture, security, QA, documentation and release reviews pass or have explicit residual risk.
- Task memory and department memory are synchronized without secrets or customer PII.
- Exact deployed SHA is reported; any remaining uncertainty is named rather than overstated.
