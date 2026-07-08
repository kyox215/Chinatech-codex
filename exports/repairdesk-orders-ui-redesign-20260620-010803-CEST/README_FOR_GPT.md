# RepairDesk Orders UI Redesign Export

Export timestamp: 2026-06-20 01:08:03 CEST
Owner: Hexiang Huang / 鹤祥
Business: Chinatech, Floridia, Siracusa, Italy

This package is prepared for giving another GPT enough context to redesign the RepairDesk work order UI.

## What Is Included

- `source/src/`: current application source copied from the workspace.
- `source/src/app/orders/`: Next.js route entries for order list, new order, order detail, and task mode.
- `source/src/features/orders/`: main order feature implementation, including screens, components, forms, model helpers, server repository/service, import and tests.
- `source/src/components/orders/`: shared order badges, money/phone rendering, and fault diagnosis picker.
- `source/src/lib/repairdesk/`: frontend API facade and shared TypeScript contracts.
- `source/src/server/api/`: API router and zod schemas used by order endpoints.
- `source/supabase/migrations/`: database migrations that define and evolve repair orders, workflow, attachments, customer contact and related contracts.
- `source/docs/`: architecture, UI generation, responsive density, mobile detail, and older order export/spec docs.
- `source/screenshots/`: desktop/mobile screenshots used as visual references.
- `ORDER_FEATURE_FUNCTIONAL_MAP.md`: human-readable feature and file map for redesign.

## Primary Goal For The Next GPT

Redesign the Orders / 工单 UI pages while preserving current business behavior and API contracts.

Do not treat this as a static mockup. This is an operating repair shop workflow. The redesigned UI must still support fast intake, lookup, diagnosis, quote, customer approval, repair, payment, pickup, notifications, print, attachments, and audit history.

## Routes To Redesign

| Route | Source Entry | Current Role |
| --- | --- | --- |
| `/orders` | `source/src/app/orders/page.tsx` -> `OrderListScreen` | Work order queue, search, filters, batch actions, print/export, desktop detail dialog |
| `/orders/new` | `source/src/app/orders/new/page.tsx` -> `NewOrderScreen` | New order intake flow |
| `/orders/[id]` | `source/src/app/orders/[id]/page.tsx` -> `OrderDetailScreen` | Full order detail, edit, finance, notification, attachment, timeline |
| `/orders/[id]/task` | `source/src/app/orders/[id]/task/page.tsx` -> `OrderTaskScreen` | Technician/scan task mode |

## Non-Negotiable Behavior To Preserve

- Data access must continue through `@/lib/repairdesk/api` or feature API facades. Client components must not import server-only modules.
- React Query invalidation must keep order list, detail, stats, customer data and workflow fresh after mutations.
- Editing and payment operations use `expected_updated_at` to avoid overwriting newer order versions.
- Amount inputs must keep string draft behavior. Empty amount fields cannot be forced into `0` while the user edits.
- Completing an order is blocked while unpaid balance remains.
- Customer approval cannot be bypassed with a plain status transition. Approval must use the approval decision flow.
- Cancellation, unfixed pickup, rework and external repair transitions require traceable reasons.
- Attachments must go through the order attachment API, then re-render from `OrderDetail.attachments`.
- Status, money and phone rendering should reuse order primitives such as `StatusBadge`, `OrderTypeBadge`, `MoneyText`, and `PhoneText`.
- Colors and surfaces must come from design tokens in `source/src/styles.css`, `source/src/lib/ui-patterns.ts`, and `source/src/lib/component-patterns.ts`.

## Recommended Redesign Workflow

1. Read `ORDER_FEATURE_FUNCTIONAL_MAP.md`.
2. Read these docs first:
   - `source/docs/UI_PAGE_GENERATION_DECLARATION.md`
   - `source/docs/COMPONENT_GENERATION_DECLARATION.md`
   - `source/docs/RESPONSIVE_DENSITY_PLAN.md`
   - `source/docs/REPAIROS_MOBILE_DETAIL_STANDARD.md`
   - `source/docs/ARCHITECTURE.md`
3. Inspect screenshots under `source/screenshots/`.
4. Redesign layout and interaction states for the four routes.
5. Keep API shapes and model helpers stable unless a separate backend/data redesign is explicitly requested.

## Suggested Prompt To Use With GPT

```text
I am redesigning the RepairDesk Orders / 工单 UI for a phone repair shop.
Use this export package as the source of truth. First read README_FOR_GPT.md and ORDER_FEATURE_FUNCTIONAL_MAP.md, then inspect the current source files under source/src/features/orders and source/src/app/orders.

Goal: propose and/or implement a better UI for /orders, /orders/new, /orders/[id], and /orders/[id]/task.

Constraints:
- Preserve all existing business functions, API contracts, mutation guards, React Query invalidation and status/payment/approval rules.
- Use the existing design tokens, UI primitives, RepairOS mobile detail standard, and order business primitives.
- Do not remove loading, empty, error, disabled, pending, mobile, desktop, print/export, attachment, approval, payment, notification, timeline or batch states.
- Give a concrete file-by-file redesign plan before editing.
```
