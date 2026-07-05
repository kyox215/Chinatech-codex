---
updated_at: "2026-07-05T14:03:23Z"
---
# TASK-20260705-006 Customer Workbench Planning

Status: implemented_pending_closeout
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

## Implemented Phase 1

1. Phase CUST-1: Added customer workbench derived model and customer order state helpers.
2. Phase CUST-2: Refreshed customer detail overview to profile-first, with order-centered history.
3. Phase CUST-3: Simplified mobile outer customer cards by removing the bottom next-step block and duplicate device chip.
4. Phase CUST-4: Kept merged tabs while restoring customer followups, messages, and full operation timeline under `跟进`.
5. Phase CUST-5: Unified total-spend/total-quoted money semantics across list/detail and excluded cancelled orders from totals.
6. Phase CUST-6: Added device empty state and tab accessibility semantics.

## Next Implementation Plan

1. Phase CUST-1: Build customer workbench derived model and tests.
2. Phase CUST-2: Refresh customer detail IA and mobile layout.
3. Phase CUST-3: Simplify outer customer list cards.
4. Phase CUST-4: Refine follow-ups and CRM links.
5. Phase CUST-5: Validate with lint, typecheck, customer tests, build, and browser screenshots.

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
