---
schema_version: 1
task_id: "TASK-20260712-005-order-custody-archive"
title: "全平台在店设备与订单归档修正"
status: "ready_for_release"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["API", "DATA", "FE", "INT", "PRODUCT", "QA", "RELEASE", "SEC"]
created_at: "2026-07-12T14:06:14Z"
updated_at: "2026-07-12T23:41:42Z"
---
# Task — 全平台在店设备与订单归档修正

## Owner request

全平台在店设备与订单归档修正

## Business value

保证所有尚未交付客户的设备订单持续出现在工作首页，只有已交付、已结案且已结清订单才归档，避免漏单和客户设备滞留。

## Scope in

- Define one global archive-eligibility invariant shared by order lists, dashboard summaries, counts, exact archive search and mock data.
- Keep `parts_arrived`, `repaired`, `notified`, `waiting_pickup`, external repair and every other not-yet-delivered order in the operational queue regardless of payment state.
- Require verified customer handover, closed workflow and settled payment before ordinary orders leave the default queue.
- Keep cancelled orders visible while the store remains responsible for the device; distinguish returned/no-custody terminal cancellation without weakening tenant isolation.
- Parse SeaTable compound source states into workflow, parts, notification, payment and delivery fields without treating notification as handover.
- Add ergonomic active-work groupings for processing, awaiting pickup, delivered-awaiting-payment and data anomalies on desktop/mobile while preserving history search permissions.
- Perform a read-only linked production audit. Repair only a deterministic, backed-up candidate manifest after forced rollback rehearsal and a no-later-activity guard pass.
- Run targeted/full tests, independent Data/Security review, main-thread QA, browser screenshots, release checks, scoped commit and Owner-approved push to `main`.

## Scope out

- Unrelated Settings Center WP-03 work, existing dirty-worktree files, role-policy expansion, customer communication or broad legacy-table/RLS containment.
- Customer, amount, payment-ledger, device, store or source-provenance edits not strictly required to correct archive eligibility.
- Destructive deletion, guessed status repair, cross-store mutation, force-push, dependency upgrades or deployment.
- A new custody schema unless the audit proves existing `delivered_at` and terminal evidence cannot represent an approved business case.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 到货、到货已通知、修好、修好已通知及其他未交付订单始终显示在默认首页
- [x] 只有已交付、已结案且已结清的订单进入归档；作废但设备仍由店铺负责的订单保持可见
- [x] SeaTable复合状态分别写入主流程、通知、交付字段且未来导入不再误归档
- [x] 精确审计并安全修复受影响生产数据，金额、客户、租户和后续业务活动不变
- [x] 桌面和移动端工作队列、待取机、待收款、历史搜索通过验证
- [ ] 完整测试、安全/数据复核、迁移或数据回滚证据通过，并仅推送本任务到main

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Current archive predicate ignores delivery | observed | `order-list-visibility.ts` | replace with explicit handover invariant |
| Stored `workflow_status` overrides legacy status fallback | observed | same predicate + canonical mapper | audit stale closed rows |
| Current main importer treats `修好已通知` as pickup evidence | observed | `seatable-riparazione.ts` | remove and add compound-state tests |
| A prior exact 24-row repair cleared stale delivery fields | observed | `TASK-20260712-001` evidence | do not assume all rows were covered; audit current live state |
| Settings Center work has local commits and uncommitted WP03-B | observed | paused task checkpoint/worktree | keep isolated and untouched |

## Decision and approval points

- Owner approved this written plan, execution and final `main` push in the current thread.
- Global code behavior is approved; data writes remain conditional on an exact candidate manifest, minimized backup, forced rollback rehearsal, no-later-activity guards and post-write verification.
- Ordinary archive eligibility is `handover confirmed AND workflow closed AND financially settled`.
- `FATTO` retains its previously approved completed meaning, but cannot disappear from operational work without valid handover evidence.
- Notification is never delivery proof. `到货已通知` and `修好已通知` use `notify_status=sent` while retaining their non-terminal workflow state.
- If cancelled-device custody cannot be represented safely with current evidence, stop at the data/schema decision gate instead of guessing.

## Work packages

1. Read-only repository and linked-production audit; freeze state matrix and candidate manifest.
2. Central domain rule and repository/dashboard/count/search integration.
3. SeaTable compound mapper and provenance-safe import correction.
4. Desktop/mobile operational queue grouping and explicit handover workflow.
5. Backup, forced rollback rehearsal, guarded production correction and independent verification.
6. Full gates, visual evidence, security/data/QA review, docs, checkpoint, scoped commit and push.

## Rollback and pause conditions

- Code rollback reverts this task commit; no prior status/permission behavior is silently rewritten.
- Production repair requires a before-image keyed by store/order/update timestamp plus a selective restore transaction rehearsed with forced rollback.
- Stop production writes if candidate counts drift, later events/payments/messages/attachments exist, store scope is ambiguous, a row lacks provenance, or money/customer/device fields would change.
- Post-commit verification must prove the exact order count, unchanged finance totals, unchanged tenant distribution and zero remaining manifest mismatches.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
