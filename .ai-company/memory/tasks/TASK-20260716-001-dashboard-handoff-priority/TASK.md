---
schema_version: 1
task_id: "TASK-20260716-001-dashboard-handoff-priority"
title: "概览页优先工单与门店交接工作台"
status: "active"
task_class: "T2"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "DOC", "FE", "FLOW", "INT", "QA", "SEC", "UX"]
created_at: "2026-07-15T22:43:38Z"
updated_at: "2026-07-16T00:20:53Z"
---
# Task — 概览页优先工单与门店交接工作台

## Owner request

概览页优先工单与门店交接工作台

## Business value

让授权门店员工在概览页立即看到应先处理的工单、优先原因、当前步骤、下一步和负责人，从而支持新手操作与换班交接。

## Scope in

- Remove the Dashboard-only mobile header chips/status rail.
- Keep the existing quick repair intake (`/orders/new`) and buyback quote (`/buyback?new=1`) entries.
- Replace duplicated KPI, insight, queue-summary, today-task, and recent-order sections with one deterministic handoff priority workspace.
- Compute priority on the server from every active order already visible to the authenticated actor, then slice the ranked result for transport/display.
- Show an allowlisted compact order projection: priority reason, current step, next step, assignee state, last update, task/detail links, customer/device identity already allowed by order-list projection.
- Support store-wide roles and technician-assigned scope without broadening existing object permissions.
- Cover loading, empty, filtered-empty, hard-error, long-text, finance-redacted, and responsive states.
- Update Dashboard UI declaration, focused unit/API/cache tests, Playwright checks, and visual evidence.
- Commit only scoped files and push the verified commit to `origin/main`.

## Scope out

- No Supabase schema/data migration, RLS change, dependency change, deployment, or production-data mutation.
- No new permission grants and no expansion of technician visibility beyond assigned orders.
- No direct status, payment, assignment, or workflow mutation from Dashboard.
- No payment-amount or unpaid aggregate priority rule in V1.
- No redesign of shared list scaffolds, order task/detail pages, or unrelated modules.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- The main thread is the sole writer and final integrator; department agents are read-only.
- Perform all work in `/private/tmp/repairdesk-dashboard-handoff-20260716`, based on verified `origin/main` `4a8458a0c5a01e0f50dc4179ee7dd4c6cde73c2e`.
- Priority must be stable for identical inputs: tier, documented reason precedence, relevant oldest timestamp, update timestamp, creation timestamp, public number, then id.
- Dashboard actions navigate only; the destination task page revalidates workflow and permissions.
- Do not return or render phone, IMEI, unlock data, supplier data, financial amounts, or aggregate unpaid counts in the priority summary.

## Acceptance criteria

- [x] 移除概览移动顶部待处理、进行中、未结清状态轨道，同时保留快速接单与快速回收报价。
- [x] 优先队列由服务端在授权店铺范围内对全部活跃工单确定性排序，不受列表前50条分页影响。
- [x] 每个优先工单展示优先原因、当前步骤、下一步、负责人和最后更新时间，点击只进入正式任务流程，不在概览直接变更状态。
- [x] 移动与桌面覆盖加载、空、错误、部分数据、长文本与权限脱敏状态，关键视口无页面横向溢出。
- [ ] lint、typecheck、test、build、目标Playwright与结果截图通过，完成后只提交本任务文件并推送main。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Quick routes already exist | observed | `dashboard-screen.tsx` | preserve exact links |
| Header rail is optional Dashboard `chips` | observed | `RepairOsListScaffold` | remove Dashboard prop only |
| Current summary reads only a six-order page | observed | `repairdesk-router.ts` | replace with all-visible active-order ranking |
| Repository scopes technicians by stable membership id | observed | `order.repository.ts` | preserve repository scope before ranking |
| Existing task guidance maps order state to current/next work | observed | `order-task-flow.ts` | reuse in pure priority model |
| Existing summary exposes unpaid aggregate broadly | observed | current router/UI | remove from new contract |
| Handoff view needs all-store visibility for non-technicians | owner intent + observed permissions | current role scope | label technician scope as assigned work |
| No production/database work is required | inferred from implementation design | source-only contract | keep release local plus Git push |

## Decision and approval points

- Owner explicitly approved implementation, full validation, commit, and push to `main`.
- R3 because this is a customer-visible operational-priority contract across API/UI; L2 because changes are reversible source changes and do not touch production data.
- No additional approval is required unless implementation reveals a permission, schema, dependency, destructive, or production-deployment requirement.

## Work packages

1. DATA/API/SEC: pure deterministic priority model, allowlisted response contract, actor-scoped server endpoint, unit/API tests.
2. FE/UX/FLOW: beginner-friendly responsive priority workspace, quick actions, status matrix, task/detail navigation only.
3. QA: cache compatibility, API tests, focused UI tests, five-viewport Playwright, lint/typecheck/test/build, screenshots.
4. ARCH/DOC/INT: review dependencies and route boundaries, update Dashboard declaration, memory checkpoint, scoped integration and push.

## Priority policy V1

1. Tier 0 — overdue: approval overdue, then pickup overdue.
2. Tier 1 — ready now: rework, repaired/not yet notified, then parts arrived.
3. Tier 2 — active work: new intake, then other active diagnosis/quote/repair work.
4. Tier 3 — waiting/follow-up: customer approval/waiting-customer, paused, unrepairable, unavailable or ordered parts, external repair, then pickup waiting.

Within a tier, the reason order listed above wins first. Orders with the same reason use the oldest relevant business timestamp, then update timestamp, creation timestamp, public order number, and id. The model ranks the complete authorized active set before applying the response limit.

## Verification and rollback

- Focused model/router/API/cache/component tests first, then `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Run the Dashboard Playwright spec at 390, 430, 768, 1024, and 1440 widths and capture mobile/desktop final screenshots without PII.
- Review final diff for unrelated files and secrets before commit.
- Rollback is a single scoped Git revert; no database rollback is necessary.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
