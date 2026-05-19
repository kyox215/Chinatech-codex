# ChinaTech RepairDesk Refactor Execution Plan

This document is the step-by-step execution checklist for modernizing the RepairDesk codebase. The goal is to keep production behavior stable while moving the project toward a modular, maintainable Next.js App Router architecture.

## Operating Rules

- Keep public routes unchanged.
- Do not redesign UI while refactoring structure.
- Do not change database schema unless a later feature explicitly requires it.
- Each step must be small enough to review, test, commit, and revert independently.
- Run the required checks before every step commit.
- Keep `src/app/*` thin: routes import feature screens or API dispatchers only.
- Put new business UI in `src/features/*`; put cross-domain pure helpers in `src/shared/*`; put shared entity rules in `src/entities/*`.

## Quality Gates

Run these before every commit:

```bash
npm run lint
npm run typecheck
npm run test
npm run knip
npm run build
```

Run these when a step touches UI page structure:

```bash
npm run test:e2e
npm run build-storybook
```

## Commit Strategy

- Step 0 commit: architecture foundation and this execution plan.
- Step 1 commit: order detail page split only.
- Step 2 commit: new order page split only.
- Step 3 commit: customer pages split only.
- Step 4 commit: server repository/service split only.
- Step 5 commit: mock/testing asset split only.

Commit messages should use this format:

```txt
Refactor: <short step name>
```

## Step 0: Architecture Foundation Baseline

### Goal

Lock in the foundation for gradual modularization.

### Included Work

- Add `features`, `entities`, `shared`, and `server/api` structure.
- Keep `src/app` route files as thin route entrypoints.
- Move repairdesk API dispatch into `src/server/api/repairdesk-router.ts`.
- Add zod request schemas in `src/server/api/repairdesk-schemas.ts`.
- Add query key factories for orders and customers.
- Add pure helpers for money, order calculations, and phone normalization.
- Add Vitest, Playwright, Storybook, Knip, and GitHub Actions CI.
- Add initial unit tests, E2E smoke tests, and Storybook stories.

### Acceptance

- All quality gates pass.
- App routes still load at the same URLs.
- No UI behavior changes are intentionally introduced.

## Step 1: Split Order Detail Page

### Goal

Reduce `src/routes/orders.$id.tsx` from a large all-in-one client page into feature-owned components.

### Target Boundaries

- Screen orchestration: `src/features/orders/screens/order-detail-screen.tsx`
- Display components: `src/features/orders/components/*`
- Dialog/form components: `src/features/orders/forms/*`

### Components To Extract

- `OrderHero`
- `OrderDetailTabs`
- `EditOrderDialog`
- `PaymentDialog`
- `ApprovalPreviewDialog`
- `RepairOrderPrintSheet`

### Acceptance

- `/orders/[id]` keeps the same visible UI and behavior.
- Editing, payment, approval preview, WhatsApp opening, timeline refresh, and print sheet still work.
- No extracted component exceeds the file size budget in `docs/ARCHITECTURE.md`.

## Step 2: Split New Order Page

### Goal

Reduce `src/routes/orders.new.tsx` into isolated form sections while preserving current create-order behavior.

### Components To Extract

- `NewOrderCustomerDeviceSection`
- `NewOrderFaultDiagnosisSection`
- `NewOrderQuotationSection`
- `NewOrderSubmitBar`

### Acceptance

- `/orders/new` can still create an order.
- Existing customer/device prefill still works.
- IMEI scanner field still writes to the device IMEI field.
- Fault diagnosis picker and quotation total stay in sync.
- Supabase and mock fallback both keep working through the existing API facade.

## Step 3: Split Customer Pages

### Goal

Move customer CRM screens from route files into `features/customers`.

### Components To Extract

- `CustomerHero`
- `CustomerDevicesPanel`
- `CustomerOrdersPanel`
- `CustomerMessagesPanel`
- `CustomerMarketingPanel`
- `CustomerFollowupsPanel`
- `CustomerTimelinePanel`

### Acceptance

- `/customers` list search, filters, KPI, and navigation still work.
- `/customers/[id]` tabs still show devices, orders, messages, marketing data, follow-ups, and timeline.
- Creating an order from customer detail still pre-fills customer/device data.
- Historical order device snapshot behavior is unchanged.

## Step 4: Split Server Data Layer

### Goal

Move domain logic out of `src/server/repairdesk-repository.ts` without changing API routes.

### Target Boundaries

- Orders repository/service: `src/features/orders/server/*`
- Customers repository/service: `src/features/customers/server/*`
- Generic route validation/dispatch remains in `src/server/api/*`

### Acceptance

- API wire shape stays the same.
- Supabase service-role access remains server-only.
- Business calculations live in services or entities, not route handlers.
- Repositories focus on database reads/writes and mapping.

## Step 5: Split Mock And Testing Assets

### Goal

Prevent `src/lib/mock/api.ts` from continuing to grow as the project expands.

### Target Boundaries

- Order mock API/builders: `src/features/orders/testing/*`
- Customer mock API/builders: `src/features/customers/testing/*`
- Shared mock utilities: `src/shared/testing/*`

### Acceptance

- Local mock fallback still works when Supabase config is unavailable.
- Storybook stories can use builders instead of duplicating large fixtures.
- Unit tests can create focused orders/customers/devices without relying on global fixture mutation.

## Current Execution Status

- Step 0: complete (`f6618fd`)
- Step 1: complete (`7642bb8`)
- Step 2: complete (`35d318f`)
- Step 3: complete (`700821c`)
- Step 4: complete
- Step 5: pending
