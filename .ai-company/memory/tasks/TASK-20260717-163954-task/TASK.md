---
schema_version: 1
task_id: "TASK-20260717-163954-task"
title: "创建工单卡住的桌面与移动端诊断报告"
status: "closed"
task_class: "T2"
risk_level: "R2"
autonomy_level: "L2"
owner: "CEO-Orchestrator"
departments: ["API", "Data", "Frontend", "QA", "UX"]
created_at: "2026-07-17T16:39:54Z"
updated_at: "2026-07-17T16:49:54Z"
closed_at: "2026-07-17T16:49:54Z"
---
# Task — 创建工单卡住的桌面与移动端诊断报告

## Owner request

创建工单卡住的桌面与移动端诊断报告

## Business value

定位创建工单卡顿与刷新恢复原因，降低重复工单和部分写入风险

## Scope in

- Read-only diagnosis of the online order-create path from UI through API, Supabase writes, audit logging, and navigation.
- Compare desktop and mobile behavior for pending, timeout, failure, refresh, and offline detection.
- Inspect current production deployment/runtime evidence without exposing customer data.
- Produce a prioritized remediation architecture and verification plan.

## Scope out

- Source-code or schema implementation.
- Production DDL/DML, deployment, commit, push, or destructive cleanup.
- Logging or retaining customer names, phone numbers, IMEI, unlock data, or credentials.

## Hard constraints

- Preserve user changes and existing behavior outside the approved scope.
- Do not claim tests, deployment, or approvals that did not occur.
- Reclassify risk if data, permission, production, finance, legal, or customer impact emerges.

## Acceptance criteria

- [x] 以代码与运行时证据区分确认事实和待观测假设
- [x] 检查电脑端与移动端的等待、超时和恢复体验
- [x] 输出分阶段解决方案与验证清单，不修改生产数据

## Facts, assumptions, and unknowns

| Item | Type | Evidence | Status / next action |
|---|---|---|---|
| Desktop and mobile share the same create mutation and API | observed | `src/features/orders/screens/new-order-screen.tsx:327` | verified |
| Browser aborts the create request after 30 seconds | observed | `src/lib/repairdesk/api.ts:681` | verified |
| Create performs multiple sequential Supabase reads/writes and is not one transaction | observed | `src/features/orders/server/order.repository.ts:3700` | verified |
| Audit is awaited after the order repository returns | observed | `src/server/api/repairdesk-router.ts:2072` | verified |
| Which exact database step caused any historical hang | unknown | no phase timing or correlation ID exists | add observability before claiming one-step causality |
| Atomic idempotent create RPC will remove ambiguous-success/partial-write classes | architecture inference | current boundaries plus Postgres transaction semantics | proposed; requires Owner-approved implementation task |

## Decision and approval points

- Proposed, not approved: replace the online multi-call create path with one service-role-only, store-scoped, idempotent database function that creates customer/device/order/event/audit atomically.
- Proposed, not approved: add correlation/operation IDs, phase timing, result lookup, and explicit timeout recovery UI.
- Production migration, deployment, and push remain outside this report task and require a separate Owner-approved implementation/release task.

## Work packages

- Frontend/UX: pending and recovery-state audit across 390px and 1440px.
- API/Data: timeout, transaction, audit, idempotency, and production read-only evidence.
- QA: targeted unit/offline tests, responsive E2E, screenshot evidence, and test-gap inventory.
- Integration Lead: root-cause synthesis, remediation options, residual risk, and closeout.

## Definition of done

- Acceptance criteria have evidence in `EVIDENCE.md`.
- Confirmed facts are separated from unobservable historical causes.
- No production mutation, implementation, deployment, commit, or push occurred.
- Residual implementation risk is assigned to Backend + Data + Frontend + QA and requires a separate approved task.
