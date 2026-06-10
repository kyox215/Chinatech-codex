# RepairDesk Agent Instructions

Use these rules when generating or editing pages in this repository.

- Read `docs/UI_PAGE_GENERATION_DECLARATION.md` before adding pages.
- Read `docs/COMPONENT_GENERATION_DECLARATION.md` before adding reusable components.
- Import reusable layout/class declarations from `src/lib/ui-patterns.ts` and component declarations from `src/lib/component-patterns.ts`.
- Keep design tokens in `src/styles.css` as the only color source.
- Use Next.js App Router files in `src/app/`; keep interactive page bodies in reusable client components when needed.
- Keep `src/app/*` thin: route files should import `features/*/screens` and avoid business logic.
- Put new order/customer business UI under `src/features/*`, shared pure helpers under `src/shared/lib`, and cross-feature entity rules under `src/entities/*`.
- Read `docs/ARCHITECTURE.md` before large feature work or refactors.
- Read `docs/RESPONSIVE_DENSITY_PLAN.md` before changing layouts, tables, dialogs, lists, or mobile behavior.
- Use `@/lib/repairdesk/api` for app data. Do not import `src/server/*` into client components.
- Prefer feature query key factories such as `ordersKeys` and `customersKeys` for React Query caches.
- Reuse `src/components/ui/*` for controls and `src/components/orders/badges.tsx` for order status/type/money/phone rendering.
- New navigation pages must update `AppSidebar`, `AppBar` breadcrumb labels, and `CommandPalette`.
- Do not reintroduce TanStack Router/Start or Vite entrypoints.
- Validate new UI with `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
