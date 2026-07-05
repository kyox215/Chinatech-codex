---
updated_at: "2026-07-05T23:21:20Z"
---
# TASK-20260705-006 Customer Workbench Planning

Status: phase_3_bottom_sheet_implemented
Owner: Hexiang Huang / 鹤祥
Decision owner: CEO-Orchestrator / RepairDesk Integration Lead
Created: 2026-07-05 CEST
Autonomy: L2 controlled implementation
Risk: medium for future implementation because customer PII, payments, store isolation, and customer/order/device relationships are involved

## Owner Goal

Plan the customer management area with less information on outer list cards and a stronger opened customer detail workbench that shows customer information, history orders, device relationships, what was repaired on each device, and useful statistics.

## In Scope

- Create a detailed planning document for the customer management workbench.
- Identify current code/data evidence.
- Propose page IA, data model, implementation phases, validation, and decisions needed.
- Ask owner choices before starting implementation.
- Implement approved phase-1 customer workbench UI/model changes after owner selected options.

## Out Of Scope

- No database migration in this phase.
- No production deployment in this phase.
- No customer merge/deduplication implementation in this phase.

## Current Evidence

- Customer detail screen already exists under `src/features/customers/screens/customer-detail-screen.tsx`.
- Customer detail panels already exist under `src/features/customers/components/customer-detail-panels.tsx`.
- Customer activity panels already exist under `src/features/customers/components/customer-activity-panels.tsx`.
- `getCustomerDetail` currently returns customer, devices, orders, tags, interactions, followups, and stats from `src/features/customers/server/customer.repository.ts`.
- `CustomerDetail` and `RepairOrder` types already contain the core fields required to derive device-order history in `src/lib/repairdesk/types.ts`.

## Deliverables

- `docs/CUSTOMER_MANAGEMENT_WORKBENCH_PLAN.md`
- This task memory packet.

## Owner Decisions Needed

Owner confirmed choices on 2026-07-05:

1. `1B`: customer detail axis is historical orders first, each order shows its device.
2. `2B`: first screen prioritizes customer profile and contact information.
3. `3B`: big money label is total spend, with unpaid amount as secondary text.
4. `4A`: tabs are merged.
5. `5A`: no device-level followups in phase 1.
6. `6A`: no customer merge/deduplication in phase 1.

Owner confirmed on 2026-07-05 for Phase 3:

7. Device detail on mobile uses option `A`: bottom sheet, not independent device detail route.

## Implemented Phase 1

1. Phase CUST-1: Added customer workbench derived model and customer order state helpers.
2. Phase CUST-2: Refreshed customer detail overview to profile-first, with order-centered history.
3. Phase CUST-3: Simplified mobile outer customer cards by removing the bottom next-step block and duplicate device chip.
4. Phase CUST-4: Kept merged tabs while restoring customer followups, messages, and full operation timeline under `跟进`.
5. Phase CUST-5: Unified total-spend/total-quoted money semantics across list/detail and excluded cancelled orders from totals.
6. Phase CUST-6: Added device empty state and tab accessibility semantics.

## Implemented Phase 2

1. Phase CUST-7: Added device-centered customer workbench derivation for linked orders, latest order, repair count, active order count, total quoted amount, unpaid amount, and warranty label.
2. Phase CUST-8: Refreshed the customer detail `设备` tab card so each device shows relationship statistics and the latest related order without entering the order detail.
3. Phase CUST-9: Fixed customer order workbench state classification so cancelled orders stay closed before unpaid-balance checks.
4. Phase CUST-10: Added model coverage for device-order statistics and cancelled-order exclusion.

## Implemented Phase 3

1. Phase CUST-11: Added device drill-down preview items so each customer device can expose recent linked order history without leaving the customer detail page.
2. Phase CUST-12: Updated the customer device card to show an expandable `设备历史` section with linked order number, status, issue, and amount.
3. Phase CUST-13: Added safer device deletion rules in the UI: devices with linked historical orders no longer show the destructive delete button and instead show the retention reason.
4. Phase CUST-14: Added model coverage for delete eligibility and history preview limits.

## Implemented Phase 3 Bottom Sheet

1. Phase CUST-11B: Added `CustomerDeviceSheet` as the owner-selected option A mobile bottom sheet drill-down.
2. Phase CUST-12B: Connected selected-device state in `CustomerDevicesPanel` and opened the Sheet from the device card body.
3. Phase CUST-13B: Converted the device card into an accessible trigger with `role=button`, keyboard Enter/Space support, and nested action/link propagation guards.
4. Phase CUST-14B: Moved full device history into the Sheet, using all linked `orderItems` rather than the card preview limit.
5. Phase CUST-15B: Added delete safety at the UI layer: linked-order devices show retention reason and no hard delete action; direct card deletes now require confirmation.
6. Phase CUST-16B: Expanded customer detail invalidation to include device and intake-search query families after device mutation.

## Next Implementation Plan

Phase 4: true device archive and deeper device lifecycle semantics.

1. Decide whether device archive should be soft-delete, hidden-from-new-orders, or full lifecycle state.
2. Add schema/API only after a separate data-migration review.
3. Preserve all historical order/device associations and tenant isolation.
4. Add repository/API tests before exposing archive actions in UI.

## Phase 3 Sub-Agent Review

Three read-only sub-agents reviewed the Phase 3 plan:

- Product analyst `019f3443-574e-7c10-9da0-15685cf081a4`: confirmed bottom sheet should focus on device identity, current risk, linked order history, and next action; hard delete must be blocked for devices with any linked order.
- UX reviewer `019f3443-5862-7be2-bf05-a87f2895db90`: recommended a near-full-screen Sheet with sticky header/action bar, 2x2 stats, newest-first order history, and dangerous actions moved out of the primary button row.
- Data reviewer `019f3443-590f-71d2-ac76-bb0af6b96140`: confirmed Phase 3 can remain pure front-end derivation with no migration; true archive requires nullable archive fields in Phase 4 and must not fake archive in UI.

Integrated decision:

- Phase 3 does not add database fields.
- Phase 3 does not implement true archive.
- Devices with any linked `repair_orders` must not be hard deleted.
- Cancelled orders remain visible in device history but excluded from repair count, totals, unpaid amount, and warranty source.

## Implementation Contract Added

The planning document now includes implementation work packages:

- WP-01 derived model and tests.
- WP-02 customer detail IA refresh.
- WP-03 outer list simplification.
- WP-04 product/UX/data/security/QA review and gates.

Owner confirmation has been received. Implementation may proceed within the approved scope above.

## No-Spawn Reason

Superseded. Two read-only sub-agents were spawned during implementation closeout:

- QA reviewer: found no P0, identified P1 money/status classification risks and P2 empty/count/accessibility risks.
- UX reviewer: confirmed the direction and raised list density, complete timeline, money semantics, empty state, and tab semantics issues.

Main thread integrated the accepted fixes and retained final ownership of code, validation, screenshots, and checkpoint.

## Visual Evidence

- `screenshots/TASK-20260705-006-customer-workbench-planning/customers-mobile-list-final.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-overview-final.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-followups-final.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-devices-phase2-viewport.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-detail-mobile-devices-phase3-history.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-phase3-mobile-devices-393.png`
- `screenshots/TASK-20260705-006-customer-workbench-planning/customer-phase3-mobile-device-sheet-393-prod.png`
