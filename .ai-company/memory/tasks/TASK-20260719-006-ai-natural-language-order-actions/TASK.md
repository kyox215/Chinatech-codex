---
schema_version: 1
task_id: "TASK-20260719-006-ai-natural-language-order-actions"
title: "AI 自然语言订单查询与对话内安全操作上线"
status: "closed"
task_class: "T3"
risk_level: "R4"
autonomy_level: "L1"
owner: "鹤祥"
departments: ["architecture", "backend", "data", "documentation", "frontend", "product", "qa", "release", "security"]
created_at: "2026-07-19T16:04:24Z"
updated_at: "2026-07-19T17:30:34Z"
closed_at: "2026-07-19T17:30:34Z"
---
# Task — AI 自然语言订单查询与对话内安全操作上线

## Owner request

AI 自然语言订单查询与对话内安全操作上线

## Business value

让门店人员用自然语言准确查询历史和当前工单，并在不离开 AI 对话的情况下安全处理待订配件与受限订单动作。

## Scope in

- Merge processing mode and order-text model usage into one collapsed composer control.
- Introduce a strict Order Query V2 contract for device, relative date, workflow/payment,
  quote-service evidence, and order-level parts status.
- Resolve relative dates on the server in the store pilot timezone and display the exact
  filters/evidence used for every result set.
- Keep result cards in the conversation; only an explicit “open order” link navigates.
- Add a server-generated inline-action contract and a separately gated, owner-only single-order
  preview/confirm path that rechecks scope, version, and idempotency before reusing atomic order
  transitions. Production activation is a separate D4 approval.
- Expand request-size and provider-egress hardening for the larger natural-language surface.
- Validate, push the exact main commit, deploy the same SHA, and perform non-mutating production
  smoke checks.

## Scope out

- Claiming that a quote line proves a repair was performed.
- Creating supplier purchase orders, allocating received stock, or claiming that a status marker
  represents a supplier order.
- Batch mutations, payments, notifications, customer messages, cost allocation, or inventory
  mutations from the assistant.
- New database tables/RPCs or unreliable historical backfills in this release.
- Enabling production inline writes or running a production write smoke without separate D4 owner
  approval.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 处理方式与今日大模型用量合并为一个默认收起的移动端紧凑控制条。
- [x] 自然语言查询覆盖相对时间、设备系列、维修项目、流程、付款和配件状态，并显示服务端实际采用的条件。
- [x] 结果卡默认不导航，只有明确点击打开订单才跳转。
- [x] 对话内受限写操作经过服务端权限、预览确认、版本校验、幂等和审计；生产旗标保持关闭。
- [x] 相关单元、集成、E2E、响应式、权限、安全、构建和生产冒烟通过。
- [x] 范围内变更非强制推送 main，生产应用部署 exact SHA 并可回滚。

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Existing order dates support a no-migration V2 | observed | `RepairOrder` and list-index projection | implement server-owned calendar filters |
| `fault_prices` is quote evidence, not performed-work evidence | observed | order contract and quote RPC | label results “依据报价项目” |
| `parts_status=needed` is sparse/order-level and normal transitions can reset it | observed | canonical status mapping/history | query honestly; do not infer procurement need |
| Existing batch/patch APIs are unsuitable for AI writes | observed | security review | do not reuse; keep single atomic action gated off in production |
| Root checkout contains unrelated owner changes | observed | git status | implement only in isolated clean worktree |

## Decision and approval points

- Read-only application release and production deployment: approved by owner in this thread.
- Production database migration: not approved and not required for phase 1.
- Production inline-write feature flag and any real/synthetic write smoke: D4, still requires a
  separate explicit owner approval after security evidence.

## Work packages

1. Contract and deterministic reconciliation for Query V2.
2. Repository date/service/parts filters with evidence-qualified response chips.
3. Compact composer control and non-navigating inline result cards.
4. Default-off owner-only action preview/confirm contract using existing atomic transitions.
5. PII/body-size hardening, focused/full tests, responsive screenshots, release and closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
