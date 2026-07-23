---
schema_version: 1
task_id: "TASK-20260723-003-startup-performance-print-audit"
title: "首次加载性能与打印可用性审计"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "IntegrationLead"
departments: ["API", "DATA", "FE", "QA", "UX"]
created_at: "2026-07-23T16:40:21Z"
updated_at: "2026-07-23T16:48:24Z"
---
# Task — 首次加载性能与打印可用性审计

## Owner request

首次加载性能与打印可用性审计

## Business value

缩短概览、工单、客户首次可用时间并明确打印功能的配置与权限门槛

## Scope in

- Read-only inspection of dashboard, order-list and customer-list startup paths.
- Browser timing in the authenticated local preview without mutating business data.
- Read-only inspection of print availability, permission, store identity and QR issuance gates.
- Evidence-backed optimization options and measurable acceptance criteria.

## Scope out

- Any work not required by the acceptance criteria.
- Production/external/destructive actions unless explicitly approved.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 给出概览、维修工单、客户管理首次加载的证据化瓶颈排序
- [x] 解释打印按钮不可点击的真实代码与配置原因
- [x] 提供分阶段优化选项、推荐顺序、风险、验证指标和配置清单

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Task title and initial metadata | observed | owner request | verify scope |
| Same-session local business-ready timing | observed | authenticated browser inspection | dashboard 11.49s; orders 5.23s; customers 4.86s |
| Shared startup chain | observed | `use-store-shell-context.ts` | onboarding then store context are sequential before page queries |
| Cross-page preload contention | observed | `app-preload-bridge.tsx`, `preload-plan.ts` | dashboard/customers start unrelated requests before primary content settles |
| Dashboard data shape | observed | `dashboard-summary.service.ts`, `order.repository.ts` | reads all active wide order rows, sorts in JS, then limits output |
| Print list permission defect | observed | `order-list-screen.tsx`, `permissions.ts` | manager single-row print is incorrectly tied to `order:export` |
| Local QR issuance flag | observed | shell environment inspection | `CUSTOMER_STATUS_QR_ENABLED` unset; local issuance fails closed after click |
| Production QR flag | unknown | deployment environment not inspected | verify before print release |

## Decision and approval points

- Recommended implementation is phased: low-risk startup/preload/UX corrections first; bootstrap and database RPC changes require a separate approved change task.
- No code, production configuration or customer data was changed in this audit.

## Work packages

- FE startup inspection, API/data inspection, print UX/permission inspection, browser timing, integration report, memory closeout.

## Definition of done

- Acceptance criteria have evidence.
- Required QA/security/data/release gates are satisfied or formally accepted.
- Documentation and formal memory are synchronized.
- Residual risks have owners and deadlines.
