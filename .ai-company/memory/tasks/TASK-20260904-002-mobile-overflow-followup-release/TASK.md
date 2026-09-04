---
schema_version: 1
task_id: "TASK-20260904-002-mobile-overflow-followup-release"
title: "补充移动端消息设置溢出审计并在全局门禁通过后发布"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang / Owner"
departments: ["INT", "UX", "QA", "RELEASE", "DOC"]
created_at: "2026-09-04T12:16:55Z"
updated_at: "2026-09-04T12:38:00Z"
---
# Task — 补充移动端消息设置溢出审计并在全局门禁通过后发布

## Owner request

在上一移动端首页修复基础上补查消息与设置页面；若全部既定全局发布门禁可被当前证据证明，则正常推送 `main` 并部署现有项目。

## Business value

补齐三语移动端代表页面覆盖，并在不涉及数据库变更的前提下把已验证的小屏可用性修复安全上线。

## Scope in

- 复用 `TASK-20260904-001-mobile-overflow-audit-fix` 的实现与验证基线。
- 对 `/messages` 与 `/settings` 在 `it-IT`、`en` 的 320px、375px 状态做只读文字/布局溢出检查。
- 如仍有代表性页面未覆盖，最多增加一组相关页面；连续两组无源码变化立即停止。
- 只修复可复现的文本横向溢出、异常截断或控件重叠；更新上一任务的 `REPORT.md`。
- 发布前验证上一三语发布任务正式 `B) RELEASED`、精确 integration SHA/tree、stable/frozen 文件、clean canonical/origin-main 基线，以及 R3/R4、clean integration、最终 QA 证据。
- 只有所有门禁都满足，才允许非强制推送 `main` 并部署既有项目；部署后验证精确 SHA 与核心健康状态。

## Scope out

- 业务逻辑、权限、API、数据模型、翻译文案、桌面视觉、依赖升级或范围外重构。
- force push、远程 SQL、生产数据库 migration、生产数据写入、秘密输出或更换部署项目。
- 若部署需要 migration，必须停止并取得一次新的精确 Owner 授权。
- 不把既有无关 health-audit 和记忆/截图目录纳入候选。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 单一主线写入者；子代理仅做互补只读 UX、QA、Release 审查，不得改文件、提交、推送、部署或接触秘密。
- 补查无源码变化时复用上一轮静态与浏览器结果，不重复全量 QA；有代码变化时最多一次定向静态检查和 Chromium 单 worker 检查。
- 发布前最多补一次最终集成 build、核心 E2E 与必要健康检查。
- 发布动作前后重新验证 integration lease、`origin/main`、精确 SHA/tree 与回滚锚点。

## Acceptance criteria

- [x] `/messages` 与 `/settings` 的 `it-IT`/`en` × 320/375 审计完成并更新原报告
- [x] 若发现问题，仅作最小、可逆、移动端限定修复并通过相称验证
- [x] 三语范围、原发布任务 `B) RELEASED`、精确 SHA/tree、stable/frozen 文件与 clean main 基线有直接证据
- [x] 最终 QA/Release 审查无未处置 P0/P1，构建与核心浏览器门禁通过或有明确阻塞
- [ ] 全局门禁通过后仅正常推送 `main` 并部署既有项目；否则停在发布前并报告
- [ ] 无数据库、migration、生产数据或强制推送操作

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| 上一移动端任务已本地关闭且未发布 | verified | `TASK-20260904-001.../EVIDENCE.md`、Registry | 复用其未提交源码/测试/报告 |
| 当前 Registry 无开放任务且工作区在 `main...origin/main` | observed | doctor/status；Git baseline | 当前任务已新建并绑定 |
| 原三语发布是否正式 `B) RELEASED` 且可作为发布基线 | verified | exact SHA/tree、CI `33866260693`、Vercel `dpl_Uuts...`、canonical smoke、原任务 E-100 | 已正式 B) RELEASED/CLOSED |
| 消息/设置是否存在 320/375 溢出 | verified | 浏览器几何审计、QA 复现、修复后 4/4 | Messages 英语 stepper 内部逃逸已修复；Settings 无变更 |

## Decision and approval points

- T3 / R3 / L2：UI 本身低风险，但包含生产 Git/部署，因此按最高操作风险执行发布治理。
- Owner 已授权在全部列明 Release Gates 满足后正常 `main` push 与既有部署；该授权不包含 force、DB、migration 或生产数据写入。
- 决策 owner 为 Integration Lead；仅其可冻结候选、提交、推送、部署和关闭任务。

## Work packages

1. WP-01 恢复上一任务与三语发布证据，冻结候选边界和发布前置条件。
2. WP-02 消息/设置移动端两组只读审计；满足停止规则后更新原报告。
3. WP-03 互补 UX、QA、Release 只读复核；主线处理分歧并冻结可测合同。
4. WP-04 如有复现缺陷，主线单一写入者实施最小修复并定向验证；无变化则复用证据。
5. WP-05 仅在全局门禁齐全时执行一次最终集成门禁、普通 commit/push 与现有部署；否则形成阻塞报告。
6. WP-06 运行态核验、回滚锚点、报告/记忆同步与关闭。

## Verification matrix

| Acceptance | Verification | Evidence target |
|---|---|---|
| 消息/设置 320/375 | Chromium 几何审计，检查文档宽度、offscreen 与控件内逃逸文本 | 原 `REPORT.md` + 当前 `EVIDENCE.md` |
| 最小变更 | scoped diff、lint/type/相关测试；无源码变化则不重跑 | `EVIDENCE.md` |
| 全局发布前置 | 原 release memory、Git exact SHA/tree、origin/main、stable/frozen 文件、独立 QA/Release 结论 | `RELEASE_PLAN.md` |
| 最终发布 | 一次 build/核心 E2E、普通 push、既有项目部署、精确 SHA 与健康检查 | `EVIDENCE.md` / `CHECKPOINTS.md` |

## Rollback and stop conditions

- UI 回滚：撤销本任务新增的移动端限定样式/测试；保留上一任务证据。
- Git 回滚：发布前记录 `origin/main` 锚点；禁止强推，异常使用可审计的普通 revert/平台回滚。
- 部署回滚：保留上一 READY deployment/alias；新部署异常立即恢复上一稳定部署。
- 停止：原三语发布未能证明 `B) RELEASED`；origin/main 或候选路径归属不清；最终门禁失败；需要 DB/migration/secret；生产目标不明确。

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
