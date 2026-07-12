---
schema_version: 1
task_id: "TASK-20260712-002-global-staff-permissions"
title: "全平台员工权限与已结清订单归档"
status: "active"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "FE", "FLOW", "INT", "QA", "SEC", "UX"]
created_at: "2026-07-12T00:08:43Z"
updated_at: "2026-07-12T03:13:37Z"
---
# Task — 全平台员工权限与已结清订单归档

## Owner request

全平台员工权限与已结清订单归档

## Business value

所有店铺统一隐藏已完成且结清/已取消订单，保留可控历史搜索，并防止员工访问全店业绩、利润和批量导出。

## Scope in

- Global role policy for every RepairDesk store; no ChinaTech-only branching.
- Default active order queue, archived order search/browse modes, and matching counts.
- Separate permissions for per-order finance, aggregate finance, profit, archive search/browse, and bulk output.
- Owner-managed role templates and supported member-level permission grants.
- Server-side projections for order/customer/inventory aggregates plus UI, print, and cache behavior.
- Desktop/mobile verification, full quality gates, scoped commit, and push to `main`.

## Scope out

- Customer, finance, status, or business-content backfill/deletion. The pending migration may backfill only stable assignment metadata.
- Production database apply unless separately approved at the database gate.
- Role enum rename (`sales` remains the code value; UI remains 前台).
- Unrelated UI, SeaTable, mobile-performance, account, or migration cleanup.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 所有店铺默认订单队列隐藏已完成且结清及已取消订单，但已付款未完成与已完成未结清仍显示。
- [x] 技术员可以查看单张授权订单金额，但不能查看全店金额汇总、利润或批量导出。
- [x] 店主可按全局角色模板和成员级授权管理店长、前台、技术员、查看员权限。
- [x] 服务端、缓存、导出和聚合接口均执行权限，角色负向测试通过。
- [ ] 桌面和移动端可视验证及完整质量门通过，仅本任务变更提交并推送 main。

## Facts, assumptions, and unknowns

| Item                                                                 | Type     | Evidence                                                  | Status / next action                          |
| -------------------------------------------------------------------- | -------- | --------------------------------------------------------- | --------------------------------------------- |
| Central role matrix exists for owner/manager/technician/sales/viewer | observed | `src/server/permissions.ts`                               | extend, do not replace                        |
| Member grants currently persist supplier actions only                | observed | migration `20260709235000_supplier_permission_grants.sql` | decide minimal compatible extension           |
| Technician finance visibility currently follows `payment:collect`    | observed | `order.repository.ts`                                     | split read from mutation permission           |
| Order list already supports search, payment and workflow filters     | observed | `OrderListFilters` + repository                           | add view mode with server default             |
| Original checkout is dirty and behind remote                         | observed | git status/fetch                                          | isolated worktree from `origin/main@77e7410e` |

## Decision and approval points

- Owner explicitly approved a global permission change, execution, and push to `main` in this thread.
- Risk is R4 because authorization and finance visibility change globally; autonomy stays L2.
- Production schema apply remains a separate D4 database gate if a migration is required.
- Release must fail closed: unknown actions/roles deny; a member grant cannot override tenant isolation or owner-only authority.

## Work packages

1. Freeze product rules, permission matrix, compatibility and rollback contract.
2. Implement server permissions, projections, archive filtering, counts and bulk-output gates.
3. Implement settings summaries/grants and order view controls using existing RepairOS patterns.
4. Partition/clear caches on actor/store authority changes and close customer/inventory aggregate paths.
5. Add role matrix, endpoint, repository, UI and negative tests.
6. Run full gates, desktop/mobile screenshots and independent FLOW/ARCH/SEC/QA review.
7. Update docs/memory, commit only task files, fast-forward `main`, push and verify remote SHA.

## Product contract

- Active queue hides orders when `status=cancelled`, or when workflow is closed and the order is financially paid.
- A paid order remains active while its workflow is not closed; a closed order remains active while unpaid.
- A complete order number, phone or IMEI search may include archived rows when the actor has archive-search permission; fuzzy archive enumeration remains forbidden.
- Owner can browse all archives. Other roles follow the role matrix or an explicit grant; no role can cross stores.
- Technician can read amounts on visible individual orders, but cannot read aggregate finance/profit or bulk export/print.
- Frontdesk (`sales`) can read individual amounts and collect normal payments, but not aggregate finance/profit/export.
- Manager receives daily operations by role; aggregate finance and archive browsing follow the final approved matrix/grants.
- Viewer receives no finance and no export.

## Rollback

- Code rollback restores the previous queue default and permission action set. The pending assignment migration is not applied by this task.
- Before production apply, capture assignment counts; rollback of the assignment backfill clears only `assignee_membership_id` values created by that migration and leaves all customer, finance, status and repair content unchanged.
- Permission-grant migration is additive, preserves existing supplier grants, and must remain independently reversible before production apply.
- Feature behavior must remain tenant-scoped and fail closed if the new grant catalog is unavailable.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
