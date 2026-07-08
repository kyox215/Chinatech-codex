# RepairDesk Refactor Notes

Last verified: 2026-06-20 CEST
Scope: system and code architecture refactor guidance only. No UI design guidance.

## 1. Refactor Goal

Restructure RepairDesk so business rules, API contracts, data access, tests, and module boundaries are easier to maintain while preserving all current system functionality.

The refactor should protect:

- Order workflow and payment behavior.
- Customer CRM and PII handling.
- Inventory/buyback state and financial calculations.
- Multi-store isolation and staff roles.
- Platform onboarding and approvals.
- Private attachments and audit logs.
- Supabase migrations and compatibility logic.

## 2. Do Not Rewrite First

Do not start by replacing the framework, deleting modules, or redesigning pages. The current project has real business rules embedded in several layers:

- `src/lib/repairdesk/api.ts`
- `src/server/api/repairdesk-router.ts`
- `src/server/api/repairdesk-schemas.ts`
- `src/features/orders/server/order.repository.ts`
- `src/features/customers/server/customer.repository.ts`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/messages/server/message-settings.repository.ts`
- `src/features/platform/server/platform.repository.ts`
- `src/features/stores/server/store.repository.ts`
- `supabase/migrations`

The safe path is contract-first refactoring.

## 3. Known Structural Risks

### Oversized Domain Files

High-risk files because they contain many responsibilities:

- `src/features/orders/server/order.repository.ts`
- `src/features/orders/screens/order-detail-screen.tsx`
- `src/features/inventory/server/inventory.repository.ts`
- `src/features/inventory/screens/inventory-screen.tsx`
- `src/features/buyback/components/buyback-quote-workspace.tsx`

Refactor direction:

- Split by domain responsibility, not arbitrary line count.
- For repositories, split query/read, write/mutation, attachments, finance/transactions, workflow, mapping, and audit helpers.
- For screen-level code, keep route orchestration separate from form state, mutation hooks, and pure business calculations.

### Mixed Legacy And Canonical Order Status

The order system contains:

- Legacy `repair_order_status`.
- Canonical workflow buckets/statuses.
- Store-configurable workflow statuses and transitions.
- Side statuses: payment, parts, approval, notify, exception.

Refactor direction:

- Do not collapse these into one field.
- Keep explicit mapping between legacy status, canonical workflow status, configured workflow status, and side statuses.
- Add characterization tests before changing status logic.

### Mock/Supabase Contract Drift

The API can use Supabase or mock fallback. If one changes without the other, tests or local preview may lie.

Refactor direction:

- Treat `src/lib/repairdesk/api.ts`, router, schema, Supabase service, and mock API as one contract group.
- Every endpoint change must update all layers or include a compatibility adapter.

### Store Isolation And Service Role

Supabase service-role access is intentionally server-side. Moving data logic to client code can break isolation and expose sensitive data.

Refactor direction:

- Keep `getRequestActor` and active-store resolution central.
- Keep business queries server-side.
- Do not expose unrestricted customer/order/inventory queries to the browser.

### Historical Docs

Several docs are snapshots and may contain outdated TanStack Router or older architecture details.

Refactor direction:

- Use current code and `docs/ARCHITECTURE.md` as current authority.
- Treat `docs/PROJECT_REFACTOR_CONTEXT_EXPORT.md` and `docs/ORDERS_FULL_EXPORT.md` as historical references unless revalidated.

## 4. Suggested Refactor Phases

### Phase 0 - Characterization And Contract Freeze

Goal:

- Preserve current behavior before moving code.

Actions:

- Write or expand characterization tests around:
  - order create/update/patch/finance/payment
  - order workflow transitions and reason requirements
  - approval decision behavior
  - customer search/list/detail/device/tag/follow-up/message flows
  - inventory transitions, checks, transactions, purchase evidence, sale
  - store context and role guards
  - attachment validation
- Snapshot API endpoint shapes from `src/lib/repairdesk/api.ts` and `repairdesk-schemas.ts`.
- Confirm mock API matches real API enough for local/E2E usage.

Exit criteria:

- Focused tests pass.
- Endpoint list and type contracts are documented.
- No production data or schema changes.

### Phase 1 - API And Service Boundaries

Goal:

- Make server contracts explicit before splitting repositories.

Actions:

- Group router cases by domain without changing paths.
- Extract endpoint maps/types if useful.
- Split schema sections by domain only if imports remain clear.
- Add tests for invalid payloads on critical endpoints.

Exit criteria:

- API paths unchanged.
- Zod validation still rejects invalid payloads.
- Client facade functions unchanged.

### Phase 2 - Orders Domain Refactor

Goal:

- Reduce order complexity while preserving workflow/payment/approval behavior.

Actions:

- Split order repository into focused modules:
  - list/read mapping
  - workflow status/transition management
  - create/update/patch
  - finance/payment
  - attachments
  - notifications/messages
  - audit/event helpers
- Keep `order.service.ts` as the stable export layer.
- Keep current App Router pages and API facade stable.

Exit criteria:

- All order model tests pass.
- API schema tests pass.
- Focused order tests pass.
- Existing order routes still compile.

### Phase 3 - Customers, Inventory, Buyback

Goal:

- Separate CRM, resale inventory, and buyback calculation responsibilities.

Actions:

- Customers:
  - keep server-side search and paginated RPC fallback.
  - isolate phone/contact merge and availability checks.
  - isolate interactions/follow-ups/tags.
- Inventory:
  - split list/read, intake/update, workflow, checks, transactions, attachments, import, mapping.
  - keep role guards and purchase evidence checks.
- Buyback:
  - keep quote calculation pure and tested.
  - keep buyback-to-inventory handoff explicit.
  - keep repair cost in profitability.

Exit criteria:

- Customer, inventory, buyback tests pass.
- No full-PII client-side list filtering.
- Inventory financial totals remain consistent.

### Phase 4 - Stores, Platform, Messages, Settings

Goal:

- Stabilize store configuration, staff, platform onboarding, and message template boundaries.

Actions:

- Keep platform approval separate from ordinary store settings.
- Keep staff role sanitization and platform admin assertions.
- Keep message template preview/rendering as a tested pure/server contract.
- Keep settings mutations invalidating relevant store/message/order workflow queries.

Exit criteria:

- Store shell tests pass.
- Platform onboarding tests pass.
- Message template tests pass.
- Settings readiness tests pass.

### Phase 5 - Legacy Cleanup And Documentation

Goal:

- Remove obsolete compatibility only after proof that no current imports depend on it.

Actions:

- Confirm no live imports from `src/routes`.
- Follow the existing owner-approved deletion workflow if deleting legacy files.
- Update docs when code boundaries change.
- Keep this export package or a replacement current after major refactor milestones.

Exit criteria:

- `rg 'from "@/routes|@/routes' src` has no matches.
- Lint, typecheck, tests, and build pass.
- Docs reflect new module boundaries.

## 5. Minimum Test Matrix For Refactor

Always run:

```bash
npm run typecheck
npm run test
```

Before closing broad refactor:

```bash
npm run lint
npm run build
```

When changing API/schema/auth/store isolation:

- `src/server/api/repairdesk-schemas.test.ts`
- `src/server/tenant-guard.test.ts`
- relevant feature testing/mock tests

When changing orders:

- `src/features/orders/model/*.test.ts`
- `src/features/orders/testing/mock-api.test.ts`
- focused E2E only if route behavior changes

When changing customers:

- `src/features/customers/model/customer-list.test.ts`
- `src/features/customers/testing/mock-api.test.ts`
- customer search/store isolation checks

When changing inventory/buyback:

- `src/features/inventory/model/*.test.ts`
- `src/features/inventory/import/*.test.ts`
- `src/features/buyback/model/*.test.ts`

## 6. Approval Gates

Require owner approval before:

- Production data changes.
- Destructive database commands.
- Supabase migration execution against remote/production.
- Dependency/framework replacement.
- Auth/permission role policy changes.
- Payment/finance behavior changes.
- External customer communication automation changes.
- Deleting legacy route files or large directories.

## 7. Backlog Candidates

These are candidates, not approved implementation tasks:

- Create an endpoint contract test that derives all API paths and ensures schemas exist.
- Add repository-level tests for order finance/payment edge cases.
- Add store isolation tests for each feature repository.
- Split huge repository files into domain services.
- Add import preview/apply golden tests for more SeaTable examples.
- Document migration dependency order after every new migration.
