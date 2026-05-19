# ChinaTech RepairDesk Architecture

This project is a modular Next.js App Router application. URLs stay in `src/app`, while business UI, data hooks, and server rules move into feature modules over time.

## Target Structure

```txt
src/
  app/                         # Next.js routes, metadata, layouts, route handlers only
  features/
    orders/
      screens/                 # route-level orchestration
      components/              # order-only display components
      forms/                   # order forms and dialogs
      api/                     # query keys and client API facade
      server/                  # order service/repository wrappers
      model/                   # schemas, rules, calculations
      testing/                 # order mock builders and handlers
    customers/
    inventory/
    messages/
  entities/
    order/                     # cross-feature order rules and formatting
    customer/
    device/
  shared/
    ui/                        # cross-domain UI only
    lib/                       # pure helpers: money, date, phone, env, result
    config/                    # routes, navigation, constants
    testing/                   # shared test render and builders
  server/
    api/                       # route dispatch, error handling, zod validation
    db/                        # Supabase admin/client
    observability/             # logging and future instrumentation
```

## Import Boundaries

- `src/app/*` imports feature screens or `server/api/*` route dispatchers only.
- Client components use `features/*/api` or `@/lib/repairdesk/api`; they never import `features/*/server` or `src/server/*`.
- `features/*/server/*` is server runtime only and can import repository/db modules.
- `shared/*` never imports `features/*`.
- Cross-feature usage goes through each feature's `index.ts`, not deep paths.
- `src/components/ui/*` remains the shadcn/Radix primitive layer. Business UI goes into feature folders unless it is genuinely shared.

## Migration Phases

1. Infrastructure: feature folders, query key factories, zod API router, tests, Storybook, CI.
2. Orders: split list/detail/new-order screens into hero, tabs, forms, dialogs, print sheet, approval dialog, and payment dialog.
3. Customers: split list/detail screens into customer hero, device tab, order tab, message tab, marketing tab, follow-up tab.
4. Data layer: move legacy repository functions from `src/server/repairdesk-repository.ts` into feature repositories.
5. Mock layer: split `src/lib/mock/api.ts` into feature-specific testing handlers/builders.

## File Size Budget

- screen: 350 lines maximum
- form/dialog: 300 lines maximum
- presentational component: 220 lines maximum
- service/repository: 450 lines maximum

If a file crosses the budget, split by responsibility rather than by arbitrary sections.

## Quality Gates

Use:

```bash
npm run check
```

This runs lint, typecheck, unit tests, and build. E2E is intentionally separate:

```bash
npm run test:e2e
```

Storybook is for reusable states of business components:

```bash
npm run storybook
```
