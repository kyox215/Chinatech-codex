# Orders / 工单 Feature Functional Map

This file summarizes the current work order feature so another GPT can redesign the UI without losing behavior.

## Product Context

Chinatech is a local phone repair shop in Floridia, Siracusa, Italy. The Orders feature is the core repair workflow: customer intake, device diagnosis, quote, approval, parts, repair, pickup, payment and history.

Primary users:

- Front desk: create orders, search customer/device history, print sheets, collect payment, notify customers.
- Technician: inspect devices, update diagnosis, scan task route, move orders through stages.
- Owner/manager: review queues, overdue approval/pickup, unpaid orders, workflow quality.

## Current Stack

- Next.js App Router, React 19, TypeScript.
- React Query for data fetching and mutation invalidation.
- shadcn/Radix UI primitives under `source/src/components/ui`.
- Tailwind v4 tokens and RepairOS class patterns.
- Supabase-backed API through `/api/repairdesk/[...path]`.
- Server data logic in feature repositories/services and API schemas.

## Page And Screen Map

| Page | Main Screen | Main Supporting Files |
| --- | --- | --- |
| Order list | `source/src/features/orders/screens/order-list-screen.tsx` | `order-list-items.tsx`, `order-list-desktop-row.tsx`, `order-list-mobile-header.tsx`, `order-list-filters.tsx`, `order-list-states.tsx`, `order-list-print-sheet.tsx`, `order-list-export.ts` |
| New order | `source/src/features/orders/screens/new-order-screen.tsx` | `new-order-customer-device-section.tsx`, `customer-intake-lookup.tsx`, `customer-phone-lookup.tsx`, `new-order-fault-diagnosis-section.tsx`, `new-order-quotation-section.tsx`, `new-order-submit-bar.tsx`, `new-order-form.ts` |
| Order detail | `source/src/features/orders/screens/order-detail-screen.tsx` | `order-hero.tsx`, `order-overview-tab.tsx`, `order-detail-tabs.tsx`, `repair-order-print-sheet.tsx`, `payment-dialog.tsx`, `notify-dialog.tsx`, `cancel-dialog.tsx`, `order-transition-reason-selector.tsx` |
| Task mode | `source/src/features/orders/screens/order-task-screen.tsx` | `order-task-flow.ts`, `order-workflow-progress.tsx`, `order-transition-reason-selector.tsx` |

## List Page Behavior

The `/orders` queue currently supports:

- Workflow phase filters: all, intake, diagnosis, quote, parts, repair, pickup, closed.
- Search by order number, customer name, phone, device or IMEI.
- Advanced filters: exact status, exception, type, technician, supplier, payment, overdue approval/pickup.
- Active filter chips with remove and clear-all behavior.
- Server-backed pagination with page size 50.
- Loading skeleton, empty state, error state and out-of-range page handling.
- Mobile floating header and compact order cards.
- Desktop dense queue rows and details opened in a dialog.
- Multi-select current page rows.
- Batch transition, limited to targets valid for every selected order.
- CSV export for current page or selected rows.
- Print current page or selected rows.
- New order dialog.

Important files:

- `source/src/features/orders/screens/order-list-screen.tsx`
- `source/src/features/orders/components/order-list-items.tsx`
- `source/src/features/orders/components/order-list-desktop-row.tsx`
- `source/src/features/orders/components/order-list-mobile-header.tsx`
- `source/src/features/orders/model/order-list-export.ts`

## New Order Behavior

The `/orders/new` flow currently supports:

- Create quick repair or dropoff repair orders.
- Select initial workflow status from server workflow settings.
- Search existing customers and show matching history devices.
- Create new customer/device when no existing record is selected.
- Prefill from query parameters such as `customerId`, `deviceId`, `imei` or `serial`.
- Capture customer name, phone, device brand, model, IMEI/serial, notes and accessory notes.
- Use fault diagnosis picker and custom fault items.
- Calculate quote total, deposit and balance.
- Apply default warranty from store settings and require a reason if changed from default.
- Show current operator/account as read-only context. Technician is written by API actor, not by an editable UI field.
- On success, invalidate order/customer queries and open the created order when used as dialog.

Important files:

- `source/src/features/orders/screens/new-order-screen.tsx`
- `source/src/features/orders/forms/customer-intake-lookup.tsx`
- `source/src/features/orders/forms/new-order-customer-device-section.tsx`
- `source/src/features/orders/forms/new-order-fault-diagnosis-section.tsx`
- `source/src/features/orders/forms/new-order-quotation-section.tsx`
- `source/src/features/orders/model/new-order-form.ts`

## Detail Page Behavior

The `/orders/[id]` detail currently supports both full page and desktop dialog surfaces.

Core behavior:

- Fetch detail through `getOrder(id)` using `ordersKeys.detail(id)`.
- Show loading skeleton and error recovery.
- Hero/header with order number, current workflow state, side status badges and actions.
- Tabs: overview and records.
- Overview: customer, device, fault/diagnosis, quote, payment, warranty, attachments and task context.
- Records: timeline events and WhatsApp/SMS message log.
- Full edit flow through `updateOrder`.
- Quick patch flow through `patchOrder`.
- Finance edit through `patchOrderFinance`.
- Payment through `recordPayment`.
- WhatsApp notification through `sendWhatsappNotification`.
- Approval request through `sendApprovalRequest`.
- Approval decision through `decideOrderApproval`.
- Status transition through `transitionOrder`.
- Cancel/unfixed/rework/external repair reason selector.
- IMEI scanning and quick IMEI patch.
- Camera/photo attachment upload through `uploadOrderAttachment`.
- Print repair order sheet.
- Mobile floating detail card layout with bottom action dock and timeline sheet.

Important files:

- `source/src/features/orders/screens/order-detail-screen.tsx`
- `source/src/features/orders/components/order-overview-tab.tsx`
- `source/src/features/orders/components/order-hero.tsx`
- `source/src/features/orders/forms/payment-dialog.tsx`
- `source/src/features/orders/forms/notify-dialog.tsx`
- `source/src/features/orders/components/repair-order-print-sheet.tsx`
- `source/src/features/capture/*`

## Task Mode Behavior

The `/orders/[id]/task` page is a technician/scan-oriented view.

It supports:

- Compact header with back and print.
- Current stage card.
- Workflow progress.
- "What to do now" guidance.
- Customer/device/quote/payment summary.
- Primary and secondary next actions from server workflow.
- Reason dialog when the target status requires a reason.
- Query invalidation after transition.

Important files:

- `source/src/features/orders/screens/order-task-screen.tsx`
- `source/src/features/orders/model/order-task-flow.ts`
- `source/src/features/orders/components/order-workflow-progress.tsx`

## Data And API Contract

Frontend API facade:

- `source/src/lib/repairdesk/api.ts`

Shared types:

- `source/src/lib/repairdesk/types.ts`

Order endpoints used by UI:

- `listOrders(filters)`
- `listOrdersPage(input)`
- `getOrderStats()`
- `listOrderWorkflow()`
- `getOrder(id)`
- `createOrder(input)`
- `updateOrder(id, input)`
- `patchOrder(id, input)`
- `patchOrderFinance(id, input)`
- `transitionOrder(id, to, { reason })`
- `batchTransition(ids, to)`
- `recordPayment(id, amount, method, expectedUpdatedAt)`
- `sendWhatsappNotification(id, body, templateKind, transitionTo, recipientPhone)`
- `sendApprovalRequest(id, body, recipientPhone)`
- `decideOrderApproval(id, input)`
- `uploadOrderAttachment(id, input)`
- `getRepairDeskOptions()`

Server routing and validation:

- `source/src/app/api/repairdesk/[...path]/route.ts`
- `source/src/server/api/repairdesk-router.ts`
- `source/src/server/api/repairdesk-schemas.ts`
- `source/src/features/orders/server/order.service.ts`
- `source/src/features/orders/server/order.repository.ts`

## Status And Workflow Model

Default concrete order statuses:

- `new`
- `rework`
- `mail_in_progress`
- `diagnosing`
- `quoted`
- `waiting_approval`
- `parts_ordered`
- `parts_arrived`
- `repairing`
- `repaired`
- `notified`
- `unfixed_pickup`
- `waiting_pickup`
- `completed`
- `cancelled`

Canonical workflow phases:

- `intake`
- `diagnosis`
- `quote`
- `parts`
- `repair`
- `pickup`
- `closed`

Do not flatten these into one visual model. The current design separates main repair phase from side statuses such as approval, parts, notification, payment and exception state.

Important files:

- `source/src/lib/mock/enums.ts`
- `source/src/features/orders/model/canonical-order-status.ts`
- `source/src/features/orders/model/order-workflow.ts`
- `source/src/features/orders/model/order-task-flow.ts`

## Business Guards To Preserve

- `expected_updated_at` is required for update, patch, finance and payment mutations.
- Payment amount must be positive and cannot exceed unpaid balance.
- Deposit cannot be negative or exceed quote total.
- Complete transition is blocked when unpaid balance remains.
- Customer approval stage must use `decideOrderApproval`; plain transition cannot bypass it.
- Rejected approval requires a reason.
- Transitions to `mail_in_progress`, `unfixed_pickup`, `cancelled`, and `rework` require reason presets or text.
- Quote/finance changes can reset approval state when quote-relevant values change.
- Attachments are limited by MIME type and size and write timeline events.
- Customer phone updates check phone availability and update customer contact phones consistently.
- Device snapshot updates must keep brand/model non-empty.

## UI Redesign Checklist

The redesigned UI must include these states:

- Desktop and mobile list.
- Desktop detail dialog and mobile full detail.
- New order as page and dialog surface.
- Loading, empty, error, disabled and pending states.
- Search, filters, active filter chips, pagination.
- Batch selection, batch transition, print and export.
- Status workflow and reason-required transitions.
- Approval request and approval decision.
- Finance draft edit, save error and unpaid balance handling.
- Payment dialog and paid/unpaid display.
- WhatsApp notification and message history.
- Timeline/history entry.
- IMEI scan entry and photo attachment upload.
- Print sheet behavior.

Responsive requirements:

- No page-level horizontal overflow.
- Mobile detail uses RepairOS Floating Card language from `REPAIROS_MOBILE_DETAIL_STANDARD.md`.
- Desktop list stays dense and efficient.
- Desktop detail dialog keeps stable workspace size across tabs.
- Variable text must truncate or wrap safely.
- Mobile editable inputs must avoid browser auto-zoom by keeping real input font size at 16px or using the existing dense input pattern.

## Visual References

Start with these screenshots:

- `source/screenshots/local-preview/01-orders-list-desktop.png`
- `source/screenshots/local-preview/02-order-detail-dialog-desktop.png`
- `source/screenshots/local-preview/03-order-detail-page-overview.png`
- `source/screenshots/local-preview/04-order-detail-finance-tab.png`
- `source/screenshots/local-preview/05-order-detail-timeline-tab.png`
- `source/screenshots/local-preview/07-order-edit-dialog.png`
- `source/screenshots/order-detail-ux-mobile-390.png`
- `source/screenshots/order-detail-ux-mobile-430.png`
- `source/screenshots/new-order-density/mobile-new-order-dialog.png`
- `source/screenshots/responsive-density/orders/390-mobile.png`
- `source/screenshots/responsive-density/orders/1440-desktop.png`

## Key File Groups

Primary order feature:

- `source/src/app/orders/`
- `source/src/features/orders/`
- `source/src/entities/order/`
- `source/src/components/orders/`

Shared UI and design system:

- `source/src/components/ui/`
- `source/src/lib/ui-patterns.ts`
- `source/src/lib/component-patterns.ts`
- `source/src/styles.css`
- `source/src/lib/motion.ts`

API and server contract:

- `source/src/lib/repairdesk/api.ts`
- `source/src/lib/repairdesk/types.ts`
- `source/src/server/api/repairdesk-router.ts`
- `source/src/server/api/repairdesk-schemas.ts`
- `source/src/features/orders/server/`

Docs to preserve design intent:

- `source/docs/UI_PAGE_GENERATION_DECLARATION.md`
- `source/docs/COMPONENT_GENERATION_DECLARATION.md`
- `source/docs/RESPONSIVE_DENSITY_PLAN.md`
- `source/docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`
- `source/docs/ARCHITECTURE.md`
