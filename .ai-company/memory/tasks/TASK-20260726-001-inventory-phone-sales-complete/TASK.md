---
schema_version: 1
task_id: "TASK-20260726-001-inventory-phone-sales-complete"
title: "完整手机库存手工录入与售卖闭环"
status: "closed"
task_class: "T3"
risk_level: "R3"
autonomy_level: "L2"
owner: "Hexiang Huang"
departments: ["Architecture", "Data", "Frontend", "Product", "QA", "Release", "Security"]
created_at: "2026-07-25T23:27:04Z"
updated_at: "2026-07-26T18:36:27Z"
---
# Task — 完整手机库存手工录入与售卖闭环

## Owner request

完整手机库存手工录入与售卖闭环

## Business value

让门店可完整手工录入单台手机、检测上架并完成客户销售、付款、质保和审计闭环

## Scope in

- Preserve the current Inventory V1/V2 data model and improve the production V2 phone workflow.
- Make manual phone intake the first, clearest path while retaining supplier purchase and repair-resale sources.
- Keep monetary fields as editable string drafts and require an explicit value before advancing.
- Make inspection edits preserve current values and expose the blockers that prevent listing or sale.
- Require serialized V2 phones to pass IMEI, activation-lock and data-wipe checks before listing, reservation or sale.
- Prevent generic status transitions from bypassing the dedicated atomic sale command.
- Improve the single-unit, full-payment sale form: existing-customer lookup, explicit payment/channel/fiscal choices, warranty and live summary.
- Reuse existing atomic sale, audit, receipt and realtime invalidation paths; add focused tests and responsive verification.
- Update inventory product/runbook documentation and task memory.

## Scope out

- Multi-item accessory cart, e-commerce checkout and accounting integration.
- Deposits, split payments, reservations with expiry, refund/return accounting and fiscal-provider automation; these require separate data contracts and migrations.
- Destructive migration or rewriting historical inventory rows.
- Applying any database migration or changing production data without a separate Owner approval.
- Deployment beyond the explicitly requested push to `main`; automatic CI/CD triggered by `main` remains observable release behavior.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.
- Work only in `/private/tmp/repairdesk-inventory-phone-sales-20260726` on `codex/inventory-phone-sales-complete` until integration.
- One application-code writer; product, data, UX, security and QA reviewers remain read-only.
- Preserve tenant scoping, role checks, idempotency, optimistic concurrency and audit evidence.

## Acceptance criteria

- [x] 可手工录入手机的身份、规格、成本、售价、质保和备注并安全保存
- [x] 本地代码与 forward migrations 已实现检测、整备、待售、上架、客户关联和单台全额销售闭环，并完成生产回滚型真实验证
- [x] 桌面和 390px 手机关键页面无字段遮挡且满足本轮权限和并发保护
- [x] lint、typecheck、359 个测试文件 / 2391 tests、27/27 页面 build 通过；生产权限、顾问和零残留复验完成
- [x] Owner 批准后应用四份最终 production migrations，提交 `f217a4f5` 并推送、核对远端 `main`

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Project implementation details | unknown | repository inspection required | investigate |
| V2 intake and atomic full-payment sale already exist | observed | `inventory-intake-screen.tsx`, V2 contracts/repositories and migrations | preserve and strengthen |
| Manual intake currently starts as supplier purchase and displays `0` amounts | observed | `inventory-intake-screen.tsx` | change to manual-first, blank draft behavior |
| Generic transition can target `sold` and bypass the dedicated sale command | observed | `inventory-workflow.ts`, `inventory.repository.ts`, router | fail closed in UI and server |
| Reservation/deposit/split-payment/refund require wider data design | inferred | current V2 sale contract enforces full payment | keep outside this release |

## Decision and approval points

- Owner explicitly approved implementation, production migrations and push to `main`.
- Production migrations `20260726181436`, `20260726181537`, `20260726182246` and `20260726182556` were applied in order.
- This release uses the existing full-payment atomic sale contract; broader finance workflows remain follow-up work.
- Independent data review confirmed that V1/V2 inspection and listing require a forward migration. The candidate now supplies a dormant expand migration plus a guarded enable migration; old V2 one-sided mutation paths remain fail closed.
- Production read-only aggregate preflight on project `xluzcoduqsdvjoouqhkc` returned `marker_items=0` and every mismatch/gate count `0`; Owner then authorized DDL.
- A production rollback-only transaction passed manual intake, inspection, ready-for-sale, commercial update and sale, then left all smoke/marker/workflow rows at zero.
- Remote `main` was verified at exact SHA `f217a4f56beaa1c61456ca1f6bbfa5e430841cd6`.

## Work packages

- Intake, evidence gathering, planning, implementation, independent review, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
