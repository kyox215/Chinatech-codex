# RepairDesk Order Lifecycle And Customer Finance Standard

Status: active
Owner: Hexiang Huang / 鹤祥
Scope: current Next.js RepairDesk customer finance projection, routine order edits, terminal correction/reopen, cancelled custody confirmation and Owner safe void
Last reviewed: 2026-07-17 CEST
Source task: `TASK-20260716-003-customer-finance-order-correction-plan`

## 1. Authority

This is the active product/API/data/security contract for the scope above. Historical export documents such as `docs/ORDERS_SPEC.md` may link here but do not override it. The implementation, migrations and executable evidence remain the final source when a documentation conflict is suspected.

## 2. Customer history and finance facts

- `order_count` and `last_order_at` describe all retained order history.
- `valid_order_count`, active repair count, `lifetime_quoted_amount` and `outstanding_amount` exclude legacy/custom cancelled, voided and soft-deleted orders.
- `lifetime_quoted_amount` is shown as `累计订单额`; it is valid quoted value, not collected revenue.
- `outstanding_amount` is shown as `待收`; it is the sum of positive live balances on valid orders.
- Actual collected/refunded/reversed value remains ledger-derived and must not be inferred from `is_paid`, quotation or balance fields.
- Repair state and payment state are orthogonal. A completed order may be `已交付 · 待收`; a cancelled balance is historical and not receivable.
- Finance-restricted responses omit amounts, payment KPIs and unpaid filters. Missing authority must never be rendered as `€0.00`.
- Customer list/read code uses the v3 fact contract. Compatibility fallback to v2 is allowed only when v3 is demonstrably absent; runtime or invalid-contract failures fail closed.

## 3. Routine active-order edits

Order detail responses project explicit server capabilities including:

- `canEditIntake`
- `canEditRepair`
- `canAdjustFinance`
- `canCollectPayment`
- `canTransition`
- `canConfirmCancelledReturn`
- `canCorrect`
- `canReopen`
- `canVoid`

The UI consumes these capabilities and does not infer authorization from role strings. Routine updates submit changed fields only. A non-financial edit must not include finance fields or require `payment:adjust`.

## 4. Terminal actions

- Manager and Owner may correct allowlisted non-financial fields on a terminal order.
- Manager and Owner may reopen a terminal order into an enabled non-terminal workflow state.
- Owner alone may safely void a pristine terminal order.
- Normal UI and APIs do not expose permanent hard deletion.
- Orders with deposits, payments, ledger evidence or inconsistent finance state cannot be silently voided or cleared; they require an explicit accounting resolution outside this command.

Correction, reopen, void and cancelled-custody confirmation use dedicated atomic commands. Each command enforces store scope, actor membership/role, allowed fields, row lock, expected `updated_at`, request idempotency key, reason or confirmation text, and one transaction for the order, terminal-operation record, timeline event and audit record.

Generic update and batch-import paths cannot mutate protected terminal/voided fields. Voided rows are immutable and retain ledger, events, attachments, messages and audit evidence.

## 5. Payment boundary

- Completed and custom-`done` orders with a positive live balance remain collectible.
- Legacy cancelled, exception-cancelled, custom-`cancelled`, voided and soft-deleted orders cannot receive a new payment.
- A previously successful payment request may replay idempotently after a later lifecycle change.
- Cancelled balances are shown only as `取消时余额（不计入待收）` to authorized finance viewers.

## 6. Database and tenant boundary

- Terminal commands are service-role-only RPCs; `anon` and `authenticated` have no EXECUTE privilege.
- `order_terminal_operations` has RLS enabled and intentionally no browser policy, forming a deny-by-default table boundary.
- Customer interaction/follow-up order references use same-store composite foreign keys.
- Deleting an order reference clears only `order_id`; the CRM row and `store_id` are retained.
- Additive migrations and retained v2 readers provide the compatibility/rollback window.

## 7. User experience and accessibility

Desktop and mobile surfaces use the same labels, capabilities, validation and result semantics. Terminal actions require visible reason/confirmation, expose pending and retryable error states, block duplicate submission and explain stale-version refresh. Status cannot be conveyed by color alone. Redacted visual evidence is required for customer finance/dual-state and terminal-action surfaces.

## 8. Verification and release

A release changing this standard must cover:

- valid/cancelled/voided aggregate parity;
- finance-redaction and forged-field denial;
- Manager/Owner/viewer/technician role boundaries;
- stale version, idempotency replay and transaction rollback;
- CRM same-store, cross-store, delete and null behavior;
- migration replay plus pgTAP;
- full lint, typecheck, unit/integration and build gates;
- desktop/mobile browser and visual evidence;
- production migration list, metadata, ACL, anomaly and advisor postchecks.

The reference evidence is `.ai-company/memory/tasks/TASK-20260716-003-customer-finance-order-correction-plan/EVIDENCE.md`.

## 9. Rollback and recovery

This contract is additive. If application behavior regresses, disable the new UI/API entry points and forward-fix while retaining lifecycle columns, terminal-operation evidence and payment ledger rows. Do not roll back by deleting audit, payment or terminal-operation records. The older customer v2 reader remains a compatibility path only; invalid v3 runtime behavior must fail closed rather than silently changing finance meaning.
