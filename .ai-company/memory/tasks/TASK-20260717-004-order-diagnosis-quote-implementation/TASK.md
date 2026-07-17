---
schema_version: 1
task_id: "TASK-20260717-004-order-diagnosis-quote-implementation"
title: "未知故障接单、检测、原子报价与客户确认闭环实施"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "QA", "Release", "SEC", "UX"]
created_at: "2026-07-17T18:30:05Z"
updated_at: "2026-07-17T19:58:20Z"
closed_at: "2026-07-17T19:52:33Z"
---
# Task — 未知故障接单、检测、原子报价与客户确认闭环实施

## Owner request

老板要求按照已完成的未知故障接单/检测/报价计划设定目标并持续执行到完成；完成后提交并推送 `main`，同时应用并验证 linked Supabase migration。

## Business value

允许前台真实记录待检测，技师补充诊断，授权角色原子发布最新报价并准确记录 WhatsApp 人工通知状态。

## Scope in

- 新建工单支持“问题明确 / 问题未知，需检测”，未知问题不生成零元假报价。
- 保留客户原始报障；技师后续独立填写诊断结果和建议维修项目。
- 桌面订单详情、移动订单详情与技师任务页形成可完成的检测/报价工作区。
- 新增窄权限 `order:quote_prepare`，并分离诊断、报价准备、报价通知能力。
- 新增服务端原子报价发布合同与 Supabase RPC：同店/对象权限、CAS、幂等、金额派生、审批重置、状态推进、事件和审计。
- 报价预览绑定最新版本；WhatsApp “打开”与员工“确认已发送”分离。
- client/server/mock/types/tests/docs 同步，完成响应式和可访问性验证。
- linked Supabase dry-run、迁移应用、postcheck；提交并推送 `main`；验证真实发布状态。

## Scope out

- 不接入 Meta WhatsApp 自动发送 Provider，不联系真实客户。
- 不批量改写历史“检测”工单，不删除或重建订单、客户、付款、事件、消息或附件。
- 不把电池/屏幕等技术问题新增为工作流状态。
- 不扩大 `payment:adjust`；付款纠正仍保持高权限。
- 不修改历史 canonical migrations，不做危险 down migration。

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Main thread is the only writer; all spawned departments are read-only.
- Implementation stays in isolated worktree `/private/tmp/repairdesk-order-quote.3zuOYe`; the dirty primary workspace is never cleaned or overwritten.
- Production Git/DB/deploy writes are serialized behind one release lock with remote pre/post assertions.
- Secrets and full customer PII may not enter task memory, logs, screenshots or commits.
- User explicitly approved `main` push and scoped Supabase migration application in the 2026-07-17 command; destructive data operations remain unapproved.

## Acceptance criteria

- [x] 未知故障可不创建零元假报价而成功接单。
- [x] 客户原始描述、技术诊断与收费报价语义分离且桌面/移动流程可完成。
- [x] 报价发布具备服务端权限、租户隔离、CAS、幂等、审批重置与审计证据。
- [x] WhatsApp 打开与人工确认发送分离，旧报价不可发送。
- [x] lint、typecheck、完整 test、build、E2E、截图、迁移 dry-run/apply/postcheck、main 推送和发布验证完成。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Existing fields can represent customer report, diagnosis and quote | verified | `repair_orders.issue_description`, `diagnosis_result`, `fault_prices` and corresponding TS types | reuse; no duplicate business columns |
| New-order picker conflates fault/diagnosis with quote lines | verified | `fault-diagnosis-picker.tsx`, `new-order-screen.tsx` | decouple unknown intake semantics |
| Combined desktop save rejects diagnosis + quote changes | verified | `order-detail-screen.tsx` combined-change guard | replace with recoverable/atomic path |
| Current WhatsApp path opens `wa.me` and records `sent` | verified | `notify-dialog.tsx`, `order.repository.ts` | split open/confirmed semantics |
| Primary workspace contains unrelated uncommitted order and migration work | observed | initial `git status` | isolated worktree created from `origin/main@9f17d0dc` |
| Latest Supabase breaking changes affect table exposure/GraphQL, not this existing-table RPC | verified external | official Supabase 2026 changelog | still enforce explicit function grants and fixed search path |
| Exact linked Supabase parity and pending migration queue | verified | pre-apply list/dry-run showed only `20260717213518`; post-apply history and dry-run are aligned/up to date | production migration gate passed |

## Decision and approval points

- **Classification:** T3, R3, L2. Production migration, role-policy expansion and public release are D3.
- **Approved by Owner:** implement the approved plan, apply the scoped migration, commit and push `main`.
- **Conservative defaults adopted from the approved plan:** front desk may prepare first quote through a new narrow permission; technician may diagnose but not set final price by default; zero-price publish requires an explicit supported exception and reason; quote requires diagnosis; customer decisions remain staff-recorded; WhatsApp remains manual `wa.me`.
- **Still forbidden:** destructive migration/data deletion, secret handling outside existing tooling, automatic external customer messaging, or weakening tenant/object authorization.
- **Required independent gates:** FLOW/UX, DATA/API/SEC, QA/Architecture, then main-thread quality/security/release arbitration.

## Work packages

- WP0: isolated baseline, failed-path tests, task contract, agent reviews and release-lock design.
- WP1: pure intake/quote-readiness/domain rules and tests.
- WP2: new-order unknown-issue behavior and offline/mock parity.
- WP3: reusable diagnosis/quote workspace for desktop/mobile/task page.
- WP4: narrow permission/capability split in server/client/types/mock.
- WP5: atomic publish-quote schema, RPC, repository/router/API and idempotency/concurrency tests.
- WP6: version-bound quote preview and WhatsApp open/confirm semantics.
- WP7: lint/typecheck/full tests/build/E2E/a11y/responsive screenshots and independent review.
- WP8: docs/memory, PG replay, linked dry-run/apply/postcheck, `main` push, deploy/smoke/observation.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
- Final commit contains only this task; unrelated primary-workspace changes are preserved.
- Production proof includes migration history, RPC definition/privileges, scoped business smoke and exact pushed SHA/deployment state.
