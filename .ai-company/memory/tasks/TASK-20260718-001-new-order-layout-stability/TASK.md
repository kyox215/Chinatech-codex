---
schema_version: 1
task_id: "TASK-20260718-001-new-order-layout-stability"
title: "新建工单客户报障紧凑化与报价中栏稳定实施"
status: "active"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["DATA", "DOC", "FE", "QA", "Release", "SEC", "UX"]
created_at: "2026-07-17T22:23:35Z"
updated_at: "2026-07-17T22:53:31Z"
---

# Task — 新建工单客户报障紧凑化与报价中栏稳定实施

## Owner request

老板要求按已批准计划设置目标并执行到完成：把客户报障降为紧凑辅助选项、报价处理固定为主区，避免切换造成空白或跳版；完成后推送 `main`，并应用/核验 linked Supabase migration。

## Business value

让前台在不跳版的统一工作台中快速记录客户报障并始终在中心完成报价，保持离线草稿和生产报价流程兼容。

## Scope in

- 新建工单客户报障主卡紧凑化，详细编辑进入移动 Sheet / 桌面 Dialog。
- 报价卡在所有模式持续渲染；桌面宽屏固定中栏，1024 双栏与移动单栏保持紧密堆叠。
- “问题明确 / 待检测”切换保留本机客户原话、报价项目与定金草稿，但在线和离线实际提交保持安全语义。
- 本机暂停字段兼容旧草稿，并在进入无期限 outbox 前剥离。
- 六档响应式、可访问性、完整测试、构建、截图、文档与发布证据。
- 从干净隔离 worktree 执行 linked Supabase 历史/dry-run/no-op 核验和非强制 `main` 推送。

## Scope out

- 不修改数据库 schema、RPC、RLS、权限或业务表；不为 UI-only 任务创建空迁移。
- 不应用、复制或提交其他并发任务的迁移与代码。
- 不改写历史工单，不创建真实客户工单，不联系客户。
- 不清理、覆盖或提交主工作区的既有未提交更改。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- 主线程为唯一写入者；UX/QA、DATA/Supabase、Release/Security 子代理只读复核。
- 实施与发布仅在 `/private/tmp/repairdesk-new-order-layout-20260718`；脏主工作区不执行 `db push`、stage、commit 或 push。
- 用户已明确批准本任务完成后非强制推送 `main` 及 scoped Supabase migration apply；若无本任务待处理 migration，正确结果为 no-op。
- 生产 Git/DB/deploy 写入必须串行，推送前重新 fetch/rebase 并核对远端 SHA；禁止 force push、`--include-all` 和 migration repair。
- 截图、日志、任务记忆不得包含真实客户 PII、凭据或秘密。

## Acceptance criteria

- [x] 桌面端报价处理固定在中间主栏，客户报障为紧凑辅助卡。
- [x] 问题明确与待检测切换不删除客户描述或报价草稿，提交语义保持安全。
- [x] 390/430/768/1024/1280/1440 响应式无横向溢出且报价卡不因模式切换移位。
- [x] 离线草稿兼容旧数据并安全保存暂停的报障与报价草稿。
- [ ] lint、typecheck、test、build、浏览器截图、Supabase linked no-op/历史核验、main 推送全部有证据。

## Facts, assumptions, and unknowns

| Item                                                                               | Type     | Evidence                                                                                                 | Status / next action                                  |
| ---------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Existing issue/quote fields already cover this UI                                  | verified | `NewOrderFormState`, `repair_orders.issue_description`, `fault_prices`, prior migration `20260717213518` | no schema change                                      |
| Primary workspace contains unrelated store-lifecycle work and untracked migrations | observed | initial and current primary `git status`                                                                 | isolate and preserve                                  |
| Unknown mode must not submit retained deposit/quote                                | verified | security review and create/offline payload inspection                                                    | resolved through shared intake resolver               |
| Paused local fields originally would enter outbox                                  | verified | offline promotion boundary review                                                                        | stripped before outbox; adapter defense test added    |
| Desktop grid rows could couple right-column whitespace to quote height             | verified | UX static review                                                                                         | independent right stack at xl                         |
| Production migration history is ahead of Git main by four employee-invite versions | verified | linked `migration list`; `origin/main@1f643313`                                                          | wait for concurrent owner to push before this release |

## Decision and approval points

- **Classification:** T3 / R3 / L2; production DB/Git/deploy actions are D3 and were explicitly approved by Owner.
- **No-migration decision:** this UI/client-draft task reuses existing schema. If linked dry-run is up to date, record no-op instead of manufacturing a migration.
- **Responsive order:** DOM, keyboard and visual order stay identical: customer/device → quote → report → unlock. At `>=1280px` these become left / center / right independent columns.
- **Paused-data decision:** TTL-bound local draft may retain paused report/quote/deposit; online create and outbox use only resolved canonical description, empty items and zero deposit.
- **Concurrent release gate:** do not copy or push the employee-invite task's four already-applied migrations; wait for its complete code/migration commit on `main`, then rebase and revalidate.

## Work packages

- WP0: recover context, classify T3/R3/L2/D3, create isolated worktree and task contract.
- WP1: compact report card + responsive quote-centered workspace with unified DOM/focus order.
- WP2: safe active-quote resolver, online create semantics and offline paused-draft compatibility.
- WP3: strip local-only paused fields at outbox boundary; add legacy/offline/adapter/component tests.
- WP4: independent UX/DATA/Security reviews, responsive documentation and six-viewport Playwright evidence.
- WP5: full lint/typecheck/test/build and checkpoint.
- WP6: serialize with concurrent release; latest-main rebase, linked list/dry-run no-op, scoped commit/push, exact-SHA deploy/smoke verification and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
