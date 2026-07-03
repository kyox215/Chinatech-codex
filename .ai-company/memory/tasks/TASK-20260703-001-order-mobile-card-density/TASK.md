# TASK-20260703-001 Order Mobile Card Density

Status: completed
Owner: Integration Lead / CEO Agent
Started: 2026-07-03T01:48:32+02:00
Completed: 2026-07-03T01:48:32+02:00
Autonomy: L2 controlled execution
Risk: R1 low UI-only density change

## Owner Goal

Compress the mobile `/orders` card layout so each order takes less vertical space while still showing the practical shop-critical information: customer, phone, device, fault, technician, amount due, payment state, and next step.

## Scope

In scope:
- Mobile order card layout in `OrderMobileCard`.
- Mobile card stage strip styling.
- Mobile browser verification at 393px width.

Out of scope:
- Backend data, workflow state machine, payments, approvals, permissions, routing, migrations, and desktop table behavior.
- Shipping, staging, committing, pushing, or deploying.

## Agents

- Main thread: Integration Lead, single writer.
- Considered but not spawned: UX/QA departments.

No-spawn reason: the owner asked to set the goal and execute a narrow UI density change. The available multi-agent flow would add overhead without independent file ownership benefit for a two-component mobile layout patch.

## Acceptance

- Mobile card no longer displays the order number in the card body.
- Normal phase short label and order type label are no longer shown under the order number area.
- Technician is shown inside the middle device/fault card.
- Payment status, amount due, and total amount are grouped on the right side.
- Bottom workflow progress uses five compact stage cells and pairs them with the next-action text.
- 393px mobile viewport has no page-level horizontal overflow.
- A visual screenshot is saved for closeout evidence.

## Outcome

- Updated `src/features/orders/components/order-list-items.tsx` to convert the mobile card into a tighter customer-left / money-right / device-middle / progress-bottom layout.
- Replaced the too-short mobile card progress rail with a full-width five-cell stage strip.
- Verified the first three mobile order cards are 180px tall at 393px viewport and that `scrollWidth === innerWidth`.
