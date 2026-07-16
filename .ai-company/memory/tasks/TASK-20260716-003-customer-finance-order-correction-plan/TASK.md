---
schema_version: 1
task_id: "TASK-20260716-003-customer-finance-order-correction-plan"
title: "客户金额口径、完成单纠错与订单安全作废实施"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["product", "ux", "frontend", "api", "data", "security", "qa", "documentation", "release"]
created_at: "2026-07-16T12:20:23Z"
updated_at: "2026-07-16T23:02:54Z"
closed_at: "2026-07-16T23:02:54Z"
---
# Task — 客户金额口径、完成单纠错与订单安全作废实施

## Owner goal

执行已批准规划，完成客户金额与状态口径统一、订单字段级权限修复、完成订单纠错/重新打开、Owner 安全作废、数据完整性、测试、文档、生产应用和 scoped main 推送。

## Approved defaults

- 客户金额展示采用“累计订单额 / 待收”；实际已收保持独立 ledger-derived 指标，不复用累计订单额。
- 客户卡片同时展示维修状态和付款状态。
- 普通完成单不提供直接覆盖式编辑；终态变更走带原因、版本锁、幂等和审计的纠错/重新打开动作。
- Manager 可更正/重新打开；Owner 可安全作废；普通 UI 不提供永久物理删除。
- 有历史收款的订单不允许静默作废或清零，必须保留 ledger 并执行明确财务处理。

## Scope in

- 客户列表/详情/筛选/统计的统一金额与状态合同。
- 订单 capability projection 和 changed-fields-only payload。
- 完成订单非财务纠错、重新打开和 Owner 软作废。
- tenant-safe schema/RPC/RLS/grants、迁移和 pgTAP/应用测试。
- 客户/订单桌面与移动交互、权限状态、视觉证据。
- 文档、任务记忆、数据库 dry-run/应用、提交和 main 推送。

## Scope out

- 普通页面永久清除订单。
- 未经事实支持的批量生产数据纠正。
- 改写已应用历史迁移或删除不可变财务流水。
- 与本任务无关的设置中心和共享脏工作区改动。

## Hard constraints

- 只在 `/private/tmp/repairdesk-customer-finance-correction-20260716` 的独立分支写业务代码。
- 主线程是唯一集成与发布写入者；rebase 期间两个 scoped writer 仅处理互不重叠的 customer/order 冲突，未暂存、提交或发布。
- 生产写入前必须重新确认 linked project、migration list、dry-run、质量/安全门禁和回滚证据。
- 不打印或提交 secrets、完整客户 PII、生产凭据或敏感请求正文。
- expand/migrate/contract；旧 RPC 在兼容窗口保留。
- 所有权限与租户边界由服务端/数据库强制，UI 只投影能力。

## Acceptance criteria

- [x] 有效报价 €90/待收 €90 在客户列表和详情均显示 €90/€90。
- [x] cancelled/voided 订单对累计、待收、有效维修次数（`valid_order_count`）和在修贡献 0；历史 `order_count/last_order_at` 保留。
- [x] 在修且待收时两个状态同时可见，桌面/移动语义一致。
- [x] 非财务字段修改不携带财务字段，普通员工不再误触 `payment:adjust`。
- [x] 伪造财务、纠错、重新打开或作废请求被服务端拒绝且零写入。
- [x] Manager 终态纠错/重新打开、Owner 作废均记录 actor/reason/before/after/version/idempotency。
- [x] 任何事务故障、stale version、幂等重放均不产生部分成功或重复事件。
- [x] 已作废记录保留 ledger/events/attachments/messages/audit，并从有效客户汇总排除。
- [x] CRM interaction/followup 的订单引用完整性已用同店、跨店、删除和空店铺断言验证。
- [x] lint、typecheck、unit/integration、102 条 pgTAP、build、7 条浏览器响应式回归和安全复核通过。
- [x] migration parity/替代 dry-run、生产应用后 metadata/data sanity、scoped commit、main push 和 exact-SHA 生产部署有证据。

## Risk and authority

- Overall: R3, L2 bounded execution.
- Owner instruction in this turn authorizes implementation, scoped push and application of planned changes after gates.
- D4/destructive hard purge remains excluded; a failed gate blocks production application.
- Existing `CONFLICT-20260619-006` and `CONFLICT-20260710-011` remain hard release gates: production database work requires remote parity/recovery evidence and one serialized release executor immediately rechecking state before/after writes.
- The serialized production apply completed for the four exact task migrations after fresh-PG17 replay, remote parity and zero-anomaly checks. The Supabase CLI dry-run was unavailable because this environment has no access token; no credential was requested or printed, and exact pending-only migration files plus linked catalog/postchecks supplied the bounded alternative evidence.

## Work packages

- WP-00: baseline, remote parity, task/branch/release lock.
- WP-01: customer aggregate v3 and contract tests.
- WP-02: dual repair/payment UI.
- WP-03: capability projection and minimal payload.
- WP-04: atomic terminal correction/reopen.
- WP-05: Owner-only soft void lifecycle.
- WP-06: data integrity/anomaly validation.
- WP-07: QA/security/browser/docs/release.
- WP-08: permanent purge intentionally excluded.

## Visual evidence

Implementation must capture redacted customer-list and order-detail correction/void states at mobile and desktop widths. Production customer PII must not appear.
