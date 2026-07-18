---
schema_version: 1
task_id: "TASK-20260718-009-ai-assistant-implementation"
title: "RepairDesk AI 小助手分阶段实施与生产发布"
status: "conditional"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "Architecture", "DATA", "DOC", "FLOW", "QA", "Release", "SEC", "UX"]
created_at: "2026-07-18T12:35:20Z"
updated_at: "2026-07-18T16:31:14Z"
closed_at: "2026-07-18T16:31:14Z"
---
# Task — RepairDesk AI 小助手分阶段实施与生产发布

## Owner request

按照 `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md` 的完整计划拆分小阶段实施；每个阶段开始前重新读取计划，完成后验证并记录检查点；全部完成后推送并部署应用。

## Business value

让员工可用自然语言安全查询订单，并通过设备标签照片生成可编辑入库草稿，后续扩展持久化、回收/工单预填与客户自助。

## Scope in

- Phase 0：ADR、任务合同、OpenAI 项目/密钥、预算与隐私审批包、威胁模型、黄金集策略、隔离实施分支。
- Phase 1：已登录员工后台的订单自然语言只读查询、受限工具、权限与门店隔离。
- Phase 2：JPEG/PNG/WebP 设备标签识别、确定性条码/OCR 合并、字段置信/冲突、可编辑库存表单草稿。
- Phase 3：可选持久草稿、RAM、多标识符、RLS、最小 Grants、幂等、迁移/恢复与 linked 验证。
- Phase 4：二手机回收和新维修单预填，不绕过证件、签名、报价、付款、授权或正式保存。
- Phase 5：独立客户公开助手，采用单订单授权、隐私告知、限流与滥用防护。
- 独立 Product/UX、Architecture/API、Data/Security/QA/Release 复核。
- 文档、截图、测试、提交、推送、部署、生产冒烟、观察与回滚证据。

## Scope out

- 模型直接执行通用 SQL、数据库 CRUD、付款、退款、权限或无确认的正式业务写入。
- 从图片自由猜测成本、售价、成色、所有权、激活锁、真伪或盒内实物配置。
- 把 OpenAI/Supabase secret、完整客户 PII、完整 IMEI、原图或完整聊天写入 Git、普通日志、截图或任务记忆。
- 与 AI 计划无关的现有工作区改动、重构、依赖升级或历史迁移清理。
- 未通过独立批准包的生产迁移、真实客户图片发送、公开客户入口激活和不可逆动作。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 业务代码只由主线程 Integration Lead 写入；子 Agent 全部只读。
- 从最新 `origin/main` 创建隔离实施分支；不得在当前混合、分叉的主工作区直接开发或 stage。
- 每个 Phase 开始前完整重读主计划，结束后执行最窄测试、独立复核和 `$memory-checkpoint`。
- AI 只查询、识别、解释和准备草稿；正式保存通过现有服务端业务流程和员工明确确认。
- OpenAI 请求默认 `store:false`；模型、提示词、工具、Schema、超时、限流、预算和功能旗标均服务端配置。
- 客户公开助手与员工后台使用独立认证/权限合同。

## Acceptance criteria

- [ ] 按 docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md 的 Phase 0-5 逐阶段重读、验证并记录检查点（Phase 0–2 已完成；Phase 3–5 等待独立 D4 批准）
- [x] AI 不直接执行正式业务写入，订单工具只读且复用服务端权限和门店隔离
- [x] 照片识别输出结构化候选并由员工确认后应用到现有表单
- [ ] 数据迁移具有 RLS、最小 Grants、幂等、回滚与 linked 验证证据（Phase 3 未执行，也未伪装为本次发布内容）
- [x] 完整 UI 在移动与桌面视口通过验证并提供脱敏截图
- [x] 通过 lint、typecheck、test、build、安全、数据、E2E、发布与生产冒烟门禁
- [x] Phase 0–2 安全切片最终提交已推送并部署，完成观察与回滚验证

## Phase progress

- [x] Phase 0：隔离基线、ADR、批准门禁、strict contracts、fake provider 与检查点
- [x] Phase 1：员工订单只读助手、桌面/移动入口、权限/门店/配额/审计、E2E 与检查点
- [x] Phase 2：照片识别到可编辑库存草稿（fake/default-off/page-memory，无业务数据写入）
- [ ] Phase 3：持久草稿与 additive data expansion
- [ ] Phase 4：回收与新维修单安全预填
- [ ] Phase 5：独立 public customer assistant default-off 实现
- [x] Release：scope-only push、CI、默认关闭部署、生产 smoke/观察/回滚

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Owner 要求按完整计划分阶段执行、最终推送和部署 | approved instruction | 当前会话用户原文 | 作为总目标，仍服从逐项生产门禁 |
| 新 OpenAI API Key 已安全写入忽略的 `.env.local` | verified | 安全创建流程与无输出存在性检查 | 不记录值；生产 Secret 仍需单独同步 |
| 当前主工作区有大量其他任务改动 | verified | `git status --short --branch` 2026-07-18 | 使用隔离分支/工作树，禁止混入 |
| 本地 `main` 与 `origin/main` 分叉 | verified | HEAD `94abc5fd`，origin/main `51d5b3b9` | 从刷新后的 origin/main 建立分支 |
| 主计划当前为待批准提案 | verified | `docs/AI_ASSISTANT_VISION_INTAKE_PLAN.md` | Owner 最新指令批准实施方向；高风险执行点单独审批 |
| 仓库当前没有 OpenAI SDK 依赖 | observed | package/lockfile搜索无匹配 | Phase 0 比较直接 fetch 与官方 SDK后决定 |
| OpenAI API 预算硬上限 | unknown / D4 | Owner 未给数值 | mock/fake 可继续；首次付费请求前批准 |
| 真实客户/IMEI/图片发送给 OpenAI | unknown / D4 | Owner 未明确数据处理选项 | 只用脱敏/合成 fixture；生产发送前批准 |
| 生产迁移和 public assistant 激活 | unknown / D4 | 计划要求独立批准 | 代码可在默认关闭旗标后实现；执行前批准 |
| Phase 1 员工订单助手 | verified | 全量测试、6 条 Playwright、截图与三组只读复核 | default-off/fake slice passed；live provider 仍关闭 |
| Phase 1 配额 | verified local boundary | `quota.ts` 与测试 | 当前为单进程 fake/default-off 防护；live 前必须 durable atomic quota |
| Phase 2 图片与草稿边界 | verified | 257 files / 1690 tests、10/10 Playwright、独立复核、脱敏截图 | 解码前头部尺寸门禁；仅页面草稿；正式保存仍走现有表单 |
| Phase 2 本地 OCR | verified safe degradation | `inventory-local-recognition.ts` 与独立安全复核 | 原生 TextDetector 可用时本地处理；Tesseract CDN fallback 已关闭 |
| Phase 2 持久化 | verified boundary | service/audit/review | 无库存、订单、草稿或图片业务写入；仅现有 allowlist 聚合审计事件 |
| Git 发布 | verified | `origin/main@8bef230f94d2` 与命名恢复分支 | fast-forward、无强推，业务提交已推送 |
| Vercel 生产发布 | verified | `dpl_HWmQRHjy9XRYPMvLT1E1oraee7jr` | exact `8bef230`、READY、主域名别名生效 |
| 生产 AI 配置 | verified fail-closed | production env 名称清单 | 无 `AI_*`/`OPENAI_*`；本地 key 未同步，缺省配置等同全关闭 |
| 生产冒烟与回滚 | verified | 无登录 HTTP、错误日志、上一部署检查 | 登录跳转正常、AI capabilities 401/no-store、无 error 日志；回滚目标 `dpl_5tbk1iFUafSExZK3ezWAkxoawQSi` / `0f5ed6e` |

## Decision and approval points

- **R4 / L2**：最高风险来自第三方 AI 处理客户/设备数据、公开客户入口、生产 schema、租户隔离与生产发布。
- **D1/D2 可自主**：只读调查、task memory、ADR 草案、fake provider、单元/合约测试、默认关闭功能旗标、隔离分支内可逆代码。
- **D3 复核后可执行**：预览环境、脱敏黄金集、非生产集成测试、兼容性新增代码。
- **D4 Owner 保留**：API 预算、真实客户数据外发、DPA/ZDR/驻留/隐私告知、生产迁移 apply、公开客户入口激活、任何直接正式写入、最终生产发布。
- Owner 已明确授权“最终推送以及部署应用”，该授权在全量质量/安全/数据/回滚门禁满足后生效；若发布内容包含尚未单独批准的生产迁移或公开客户激活，必须再次提供执行级批准包。

## Final outcome

- **条件关闭范围：** Phase 0–2 的 default-off/fake/page-memory 安全切片已实施、验证、推送并部署到生产。
- **生产行为：** 所有 AI 能力缺省关闭；无 OpenAI 生产密钥、无外部 AI 请求、无生产迁移、无图片或草稿持久化、无公开客户入口。
- **未关闭范围：** Phase 3–5 仍是独立高风险后续，必须先完成预算、隐私/数据处理、依赖、持久化/RLS/Grants、滥用防护和公开激活批准。
- **关闭依据：** `CLOSEOUT_REPORT.md`、E-033–E-039、最终检查点和三组只读复核。

## Work packages

- WP-00 Context/Contract：恢复上下文、隔离分支、官方资料、ADR、审批表、评测/预算/威胁模型。
- WP-01 Staff Order Assistant：订单只读意图、白名单工具、BFF、权限测试、员工 UI。
- WP-02 Vision Intake：图片安全管线、严格 Schema、条码/OCR 合并、库存草稿和字段复核 UI。
- WP-03 Durable Data：RAM/多标识符/AI 草稿、幂等、RLS/Grants、迁移与恢复。
- WP-04 Internal Workflow Expansion：回收和新工单预填。
- WP-05 Public Customer Assistant：独立认证、单订单授权、限流、隐私与 abuse controls。
- WP-06 Verify/Release：全量门禁、截图、文档、推送、部署、生产冒烟、观察和回滚。

详细依赖、阶段退出条件和证据矩阵见 `PHASE_PLAN.md`。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
