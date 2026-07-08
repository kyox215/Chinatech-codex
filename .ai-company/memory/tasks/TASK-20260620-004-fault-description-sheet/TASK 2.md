# TASK-20260620-004 Fault Description Sheet

Status: verified
Owner: Hexiang Huang / 鹤祥
Lead: Codex main thread / RepairDesk Integration Lead
Created: 2026-06-20 01:21 CEST

## Goal

Improve the mobile order detail "编辑故障描述" Sheet so repair quote items can be brought into `issue_description` or `diagnosis_result` without duplicating existing manual text.

## Scope

- Add pure text helpers for repair-item-to-description behavior.
- Add unit coverage for filtering, appending, dedupe, separators, and short custom item names.
- Update the existing Sheet UI with batch add, single item add, already-added state, and empty source state.
- Optimize the same workflow for compact/high-density display on mobile and desktop surfaces.

## Out Of Scope

- No schema, migration, API contract, notification, WhatsApp, payment, permission, or production data changes.
- No automatic customer communication.

## Files

- `src/features/orders/model/order-fault-description.ts`
- `src/features/orders/model/order-fault-description.test.ts`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/orders/components/order-overview-tab.tsx`

## Notes

- The worktree already had unrelated pending changes, including status-transition changes in `order-detail-screen.tsx`. This task only added the fault-description helper and Sheet behavior.
- Follow-up density pass on 2026-06-20 01:38 CEST tightened the mobile fault-description Sheet and made desktop issue/diagnosis fields two-column on wider surfaces.
