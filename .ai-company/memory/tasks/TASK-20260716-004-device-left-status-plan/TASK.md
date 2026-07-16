---
schema_version: 1
task_id: "TASK-20260716-004-device-left-status-plan"
title: "新建工单留机与设备保管状态完整规划"
status: "closed"
phase: "planned_waiting_owner_start"
task_class: "T2"
risk_level: "R1"
implementation_risk_level: "R3"
autonomy_level: "L2"
owner: "鹤祥"
departments: ["INT", "FLOW", "UX", "DATA", "API", "ARCH", "SEC", "QA", "RELEASE"]
created_at: "2026-07-16T19:58:27+02:00"
updated_at: "2026-07-16T18:10:12Z"
closed_at: "2026-07-16T18:10:12Z"
---

# TASK-20260716-004 Device Custody Status Plan

Status: planning complete; future implementation not started
Owner: Hexiang Huang / 鹤祥
Decision owner: CEO Agent / RepairDesk Integration Lead
Task class: T2 cross-domain workflow planning
Planning risk: R1, documentation only
Implementation risk: R3, because the future change touches order workflow, physical custody evidence, unlock credentials, offline sync, and an additive database migration
Autonomy: L2 controlled execution
Decision authority: D3 for production migration, deploy, permission-policy changes, or destructive historical corrections
Baseline: `main == origin/main == 6717932e316cbe5054709646ca7ea1087f517a49`

## Owner Goal

Check whether new orders currently support a customer not leaving the phone, then produce a complete plan for new-order and order-detail behavior when the device remains with the customer.

## Verified Answer

The option does not currently exist. The visible `留存` control is an accessory-notes picker, while `快修 / 送修` is the repair service type. Neither represents device custody.

## Proposed Product Decision

Add an independent, auditable `device_custody_status` field:

- `with_shop`: the shop accepted custody/responsibility for the device; this also covers an approved external-repair handoff.
- `with_customer`: the customer kept or currently holds the device.
- `NULL`: legacy status is unknown; it is not selectable for new orders.

The new-order UI visibly defaults to `已留店`, but always sends the choice explicitly. The detail page provides dedicated `确认收机`, `确认归还`, and `补录状态` actions with version locking and audit history.

## In Scope for Future Implementation

- Additive schema migration, shared types, API validation, repository mapping, events, and cache invalidation.
- New-order desktop/mobile control and offline-create draft support.
- Order-detail desktop/mobile status, dedicated custody actions, conflict/error/permission states.
- Cancellation, completion, pickup reminders, queues, workflow guards, print, import/export, and unlock-credential behavior.
- Unit, integration, E2E, accessibility, responsive, security, tenant-isolation, migration, and rollback evidence.

## Out of Scope in This Planning Turn

- No business-code implementation.
- No database migration creation or application.
- No production data inspection, backfill, deploy, commit, or push.
- No destructive cleanup of historical orders.

## Deliverables

- `PLAN.md`: integrated product, UX, architecture, data, security, QA, rollout, and rollback plan.
- `EVIDENCE.md`: current-code findings pinned to the verified Git baseline.
- `CHECKPOINTS.md`, `HANDOFF.md`, and `MEMORY_DELTA.md`: recoverable task packet.

## Real Sub-Agents Used

| Canonical task               | Department package        | Permission | Result                                                                                                                        |
| ---------------------------- | ------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/root/device_left_flow_ux`  | FLOW + UX                 | read_only  | Audited current screens, cancellation/completion gaps, state UX, responsive states, and acceptance criteria.                  |
| `/root/device_left_data_api` | DATA + API + Architecture | read_only  | Audited schema/API/repository/offline/data-roundtrip paths and produced migration, concurrency, cache, and rollback guidance. |
| `/root/device_left_qa`       | QA + Security             | read_only  | Audited permissions, tenant isolation, unlock privacy, pickup logic, test matrix, browser evidence, and release gates.        |

The main thread remains the single writer, decision owner, and final integrator.

## Approval State

The plan is complete and proposed. Saying `开始` authorizes local, reversible implementation within the approved plan, but does not by itself authorize production migration application, deploy, destructive backfill, or a permission-policy expansion.
